// api/setup-txline.js
// One-shot setup route for phone-only workflows (GitHub + Vercel, no terminal).
//
// HOW TO USE:
// 1. Put this file at:  api/setup-txline.js  in your GitHub repo (create via GitHub app/website)
// 2. Deploy on Vercel (it auto-deploys when you commit)
// 3. Open this URL in your phone browser:
//      https://YOUR-PROJECT.vercel.app/api/setup-txline
// 4. It will generate a devnet wallet, airdrop SOL, subscribe on-chain to
//    TxLINE's free World Cup tier, activate an API token, and return
//    everything as JSON on the page.
// 5. Copy the "jwt" and "apiToken" values it returns.
// 6. In Vercel (Project > Settings > Environment Variables, works fine on
//    phone browser), add:
//      TXLINE_JWT       = <jwt value>
//      TXLINE_API_TOKEN = <apiToken value>
//      TXLINE_API_ORIGIN = https://txline-dev.txodds.com
// 7. Redeploy (Vercel > Deployments > tap the three dots > Redeploy).
//
// IMPORTANT: This creates a fresh wallet every time you hit the URL.
// Only run it ONCE. If you need to re-run, that's fine — it just makes a
// new wallet and subscription, which is harmless on devnet.

const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} = require("@solana/spl-token");
const axios = require("axios");
const nacl = require("tweetnacl");

const RPC_URL = "https://api.devnet.solana.com";
const API_ORIGIN = "https://txline-dev.txodds.com";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_TOKEN_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];

module.exports = async function handler(req, res) {
  try {
    // 1. Generate wallet
    const walletKeypair = Keypair.generate();
    const wallet = new anchor.Wallet(walletKeypair);
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // 2. Airdrop devnet SOL
    const airdropSig = await connection.requestAirdrop(walletKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSig, "confirmed");

    // 3. Fetch program IDL from-chain, build program client
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
    if (!idl) throw new Error("Could not fetch TxLINE program IDL");
    const program = new anchor.Program(idl, provider);

    // 4. Derive accounts
    const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], program.programId);
    const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_TOKEN_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], program.programId);
    const userTokenAccount = getAssociatedTokenAddressSync(TXL_TOKEN_MINT, provider.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    // 5. Subscribe on-chain (free tier)
    const txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: provider.wallet.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: TXL_TOKEN_MINT,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 6. Guest JWT
    const authResponse = await axios.post(`${API_ORIGIN}/auth/guest/start`);
    const jwt = authResponse.data.token;

    // 7. Activate API token
    const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
    const message = new TextEncoder().encode(messageString);
    const signatureBytes = nacl.sign.detached(message, walletKeypair.secretKey);
    const walletSignature = Buffer.from(signatureBytes).toString("base64");

    const activationResponse = await axios.post(
      `${API_ORIGIN}/api/token/activate`,
      { txSig, walletSignature, leagues: SELECTED_LEAGUES },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
    const apiToken = activationResponse.data.token || activationResponse.data;

    // 8. Return everything — copy jwt + apiToken into Vercel env vars
    res.status(200).json({
      success: true,
      message: "Copy jwt and apiToken below into Vercel Environment Variables as TXLINE_JWT and TXLINE_API_TOKEN, then redeploy.",
      walletPublicKey: walletKeypair.publicKey.toBase58(),
      subscribeTxSig: txSig,
      jwt,
      apiToken,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
};
