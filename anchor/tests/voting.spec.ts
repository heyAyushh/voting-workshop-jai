import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import { Voting } from "../target/types/voting";

const IDL = require("../target/idl/voting.json");
const PROGRAM_ID = new PublicKey(IDL.address);

describe("Voting", () => {
  let context;
  let provider;
  let votingProgram: anchor.Program<Voting>;
  let pollStartTime: number;
  let pollEndTime: number;

  beforeAll(async () => {
    context = await startAnchor("", [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(IDL, provider);

    pollStartTime = Math.floor(Date.now() / 1000) + 5; // 5 seconds in the future
    pollEndTime = pollStartTime + 60; // Poll runs for 1 minute
  });

  it("initializes a poll", async () => {
    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(pollStartTime),
      new anchor.BN(pollEndTime),
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);
    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(pollStartTime);
  });

  it("initializes candidates", async () => {
    await votingProgram.methods.initializeCandidate("Pink", new anchor.BN(1)).rpc();
    await votingProgram.methods.initializeCandidate("Blue", new anchor.BN(1)).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(0);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(0);
    expect(blueCandidate.candidateName).toBe("Blue");
  });

  it("prevents voting before poll starts", async () => {
    await expect(
      votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc()
    ).rejects.toThrow("The poll has not started yet.");
  });

  it("vote candidates successfully", async () => {
    console.log(`⏳ Waiting for poll to start at: ${new Date(pollStartTime * 1000).toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for poll start time

    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Blue", new anchor.BN(1)).rpc();
    await votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc();

    const [pinkAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Pink")],
      votingProgram.programId,
    );
    const pinkCandidate = await votingProgram.account.candidate.fetch(pinkAddress);
    expect(pinkCandidate.candidateVotes.toNumber()).toBe(2);
    expect(pinkCandidate.candidateName).toBe("Pink");

    const [blueAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8), Buffer.from("Blue")],
      votingProgram.programId,
    );
    const blueCandidate = await votingProgram.account.candidate.fetch(blueAddress);
    expect(blueCandidate.candidateVotes.toNumber()).toBe(1);
    expect(blueCandidate.candidateName).toBe("Blue");
  });

  it("prevents double voting by the same user", async () => {
    await expect(
      votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc()
    ).rejects.toThrow("You have already voted in this poll.");
  });

  it("prevents voting after poll ends", async () => {
    console.log(`⏳ Waiting for poll to end at: ${new Date(pollEndTime * 1000).toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, 61000)); // Wait for poll to end

    await expect(
      votingProgram.methods.vote("Pink", new anchor.BN(1)).rpc()
    ).rejects.toThrow("The poll has ended.");
  });
});
