import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Voting } from "../target/types/voting";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("voting", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Voting as Program<Voting>;

    const pollId = new anchor.BN(1);
    const description = "Test Poll";
    const pollStart = new anchor.BN(Math.floor(Date.now() / 1000));
    const pollEnd = new anchor.BN(Math.floor(Date.now() / 1000) + 86400); // 24 hours from now
    const candidateName = "Candidate 1";

    it("Initializes a poll", async () => {
        const [pollPda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8)],
            program.programId
        );

        await program.methods
            .initializePoll(pollId, description, pollStart, pollEnd)
            .accounts({
                signer: provider.wallet.publicKey,
                poll: pollPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const pollAccount = await program.account.poll.fetch(pollPda);
        assert.equal(pollAccount.pollId.toString(), pollId.toString());
        assert.equal(pollAccount.description, description);
    });

    it("Initializes a candidate", async () => {
        const [pollPda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8)],
            program.programId
        );

        const [candidatePda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8), Buffer.from(candidateName)],
            program.programId
        );

        await program.methods
            .initializeCandidate(candidateName, pollId)
            .accounts({
                signer: provider.wallet.publicKey,
                poll: pollPda,
                candidate: candidatePda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const candidateAccount = await program.account.candidate.fetch(candidatePda);
        assert.equal(candidateAccount.candidateName, candidateName);
        assert.equal(candidateAccount.candidateVotes.toString(), "0");
    });

    it("Allows a voter to vote once", async () => {
        const [pollPda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8)],
            program.programId
        );

        const [candidatePda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8), Buffer.from(candidateName)],
            program.programId
        );

        const [voteRecordPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vote_record"),
                pollId.toBuffer("le", 8),
                provider.wallet.publicKey.toBuffer(),
            ],
            program.programId
        );

        await program.methods
            .vote(candidateName, pollId)
            .accounts({
                signer: provider.wallet.publicKey,
                poll: pollPda,
                candidate: candidatePda,
                voteRecord: voteRecordPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const candidateAccount = await program.account.candidate.fetch(candidatePda);
        assert.equal(candidateAccount.candidateVotes.toString(), "1");

        const voteRecord = await program.account.voteRecord.fetch(voteRecordPda);
        assert.equal(voteRecord.hasVoted, true);
    });

    it("Prevents a voter from voting twice", async () => {
        const [pollPda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8)],
            program.programId
        );

        const [candidatePda] = PublicKey.findProgramAddressSync(
            [pollId.toBuffer("le", 8), Buffer.from(candidateName)],
            program.programId
        );

        const [voteRecordPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("vote_record"),
                pollId.toBuffer("le", 8),
                provider.wallet.publicKey.toBuffer(),
            ],
            program.programId
        );

        try {
            await program.methods
                .vote(candidateName, pollId)
                .accounts({
                    signer: provider.wallet.publicKey,
                    poll: pollPda,
                    candidate: candidatePda,
                    voteRecord: voteRecordPda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            assert.fail("Expected the second vote to fail");
        } catch (error) {
            assert.include(error.message, "Voter has already cast a vote in this poll");
        }

        const candidateAccount = await program.account.candidate.fetch(candidatePda);
        assert.equal(candidateAccount.candidateVotes.toString(), "1"); // Vote count should still be 1
    });
}); 