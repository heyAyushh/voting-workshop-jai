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

  beforeAll(async () => {
    context = await startAnchor('', [{ name: "voting", programId: PROGRAM_ID }], []);
    provider = new BankrunProvider(context);
    votingProgram = new anchor.Program<Voting>(
      IDL,
      provider,
    );
  });

  it("initializes a poll with valid poll_end", async () => {
    const currentTime = Math.floor(Date.now() / 1000); // Get current UNIX timestamp
    const futurePollEnd = new anchor.BN(currentTime + 3600); // 1 hour in the future

    await votingProgram.methods.initializePoll(
      new anchor.BN(1),
      "What is your favorite color?",
      new anchor.BN(currentTime),
      futurePollEnd,
    ).rpc();

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      votingProgram.programId,
    );

    const poll = await votingProgram.account.poll.fetch(pollAddress);

    console.log(poll);

    expect(poll.pollId.toNumber()).toBe(1);
    expect(poll.description).toBe("What is your favorite color?");
    expect(poll.pollStart.toNumber()).toBe(currentTime);
    expect(poll.pollEnd.toNumber()).toBeGreaterThan(currentTime); // ✅ Validation
  });

  it("fails to initialize a poll with past poll_end", async () => {
    const currentTime = Math.floor(Date.now() / 1000); // Get current UNIX timestamp
    const pastPollEnd = new anchor.BN(currentTime - 3600); // 1 hour in the past

    try {
      await votingProgram.methods.initializePoll(
        new anchor.BN(2),
        "What is your favorite sport?",
        new anchor.BN(currentTime),
        pastPollEnd,
      ).rpc();
      throw new Error("Test failed: Poll should not be initialized with past poll_end");
    } catch (err) {
      console.log("Expected error:", err.message);
      expect(err.message).toContain("Poll end time must be in the future");
    }
  });
});
