import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Voting } from "../target/types/voting";
import { expect } from "@jest/globals";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(
      IDL,
      provider,
    );
  });

  it("initializes a poll with valid end time", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const futureTime = currentTime + 3600; // 1 hour in the future

    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(currentTime),
      new anchor.BN(futureTime),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(currentTime);
    expect(poll.pollEnd.toNumber()).toBe(futureTime);
  });

  it("fails to initialize poll with past end time", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const pastTime = currentTime - 3600; // 1 hour in the past

    try {
      await votingProgram.methods.initializePoll(
        new anchor.BN(2),
        "Past poll",
        new anchor.BN(currentTime),
        new anchor.BN(pastTime),
      ).rpc();
      // If we reach here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      expect(error.toString()).toContain("Poll end time must be in the future");
    }
  });

  it("fails to initialize poll with invalid timestamp", async () => {
    try {
      await votingProgram.methods.initializePoll(
        new anchor.BN(3),
        "Invalid timestamp poll",
        new anchor.BN(100),
        new anchor.BN(0), // Invalid timestamp
      ).rpc();
      // If we reach here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      expect(error.toString()).toContain("Invalid Unix timestamp");
    }

    console.log(poll);
    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(100);
    expect(poll.candidateAmount.toNumber()).toBe(0);
    expect(poll.totalVotes.toNumber()).toBe(0);

  });

  it("initializes candidates and updates poll", async () => {
    await votingProgram.methods.initializeCandidate(
      "Pink",
      new anchor.BN(1),
    ).rpc();
    await votingProgram.methods.initializeCandidate(
      "Blue",
      new anchor.BN(1),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );
    const poll = await votingProgram.account.poll.fetch(pollAddress);
    expect(poll.candidateAmount.toNumber()).toBe(2);

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(0);

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
  });

  it("votes for candidates and updates poll total votes", async () => {
    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Blue", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );
    const poll = await votingProgram.account.poll.fetch(pollAddress);
    expect(poll.totalVotes.toNumber()).toBe(3);

    // Verify first vote was counted
    let pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(1);

    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(2);

    // Second vote should fail
    try {
      await votingProgram.methods.vote(
        "Pink",
        new anchor.BN(1),
      ).rpc();
      throw new Error("Expected second vote to fail");
    } catch (error) {
      expect(error.message).toContain("Voter has already cast a vote in this poll");
    }

    // Verify vote count hasn't changed
    pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(1);

    // Different user can still vote for Blue
    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );

    await votingProgram.methods.vote(
      "Blue",
      new anchor.BN(1),
    ).rpc();

    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(1);
  });
});
