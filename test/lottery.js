const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe.only("Multi Token Lottery", function () {
  async function deploy() {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();

    const lotteryFactory = await ethers.getContractFactory("MultiTokenLottery");
    const bearTokenFactory = await ethers.getContractFactory("FuckTheBears");
    const mockFactory = await ethers.getContractFactory("MyToken");

    // Set signers[1] as the reserveFund
    const lottery = await lotteryFactory.deploy(signers[1].address);
    const BearToken = await bearTokenFactory.deploy('BEARTOKEN', 'BEAR', signers[0]);
    const mockToken = await mockFactory.deploy();

    return { lottery, signers, BearToken, mockToken };
  }

  describe("Deployment", function () {
    it("Should set the right deploy", async function () {
      this.timeout(600000);
      const { lottery, mockToken } = await loadFixture(deploy);
      console.log(`\t\t\t\t\tLottery contract address: ${lottery.target}`);

      // Fetch name, symbol, and supply properly
      const name = await mockToken.name();
      const symbol = await mockToken.symbol();
      const supply = await mockToken.totalSupply(); // Assuming totalSupply() is the function to get supply

      console.log(`\t\t\t\t\tToken Name: ${name}`);
      console.log(`\t\t\t\t\tToken Symbol: ${symbol}`);
      console.log(`\t\t\t\t\tToken Supply: ${supply.toString()}`); // Convert supply to string if it's a BigNumber
    });
  });

  describe("Lottery Creation", function () {
    it("Should create a lottery correctly", async function () {
      const { lottery, mockToken, signers } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      await lottery.createLottery(mockToken.target, duration, ticketPrice);

      const lotteryData = await lottery.lotteries(mockToken.target);

      console.log(`\t\t\t\t\tLottery Token Address: ${lotteryData.tokenAddress}`);
      console.log(`\t\t\t\t\tLottery Ticket Price: ${lotteryData.ticketPrice}`);
      console.log(`\t\t\t\t\tLottery Round End Time: ${lotteryData.roundEndTime}`);
      console.log(`\t\t\t\t\tLottery Round Duration: ${lotteryData.roundDuration}`);

    });

    it("Should not allow creating a lottery for the same token twice", async function () {
      const { lottery, mockToken } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      await lottery.createLottery(mockToken.target, duration, ticketPrice);

      await expect(
        lottery.createLottery(mockToken.target, duration, ticketPrice)
      ).to.be.revertedWith("Lottery already exists for this token");
    });
  });

  describe("Ticket Purchasing", function () {
    it("Should allow users to buy tickets", async function () {
      const { lottery, mockToken, signers } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const oneTicketPrice = ethers.parseUnits("1", 18); // 1 token
      const ticketsPrice = (Number(oneTicketPrice) * 5).toString(); // buying 5

      // Ensure lottery and mockToken are correctly deployed
      console.log(`\t\t\t\t\tLottery Contract Address: ${lottery.target}`);
      console.log(`\t\t\t\t\tBear Token Contract Address: ${mockToken.target}`);

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, oneTicketPrice);

      // Log the ticket price set in the contract
      const lotteryData = await lottery.lotteries(mockToken.target);
      console.log(`\t\t\t\t\tOne Ticket Price: ${lotteryData.ticketPrice.toString()}`);

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets (now signers[2] is used instead of signers[1])
      await mockToken.transfer(signers[2].address, ticketsPrice);

      // Log the buyer's balance before approval
      const buyerBalanceBefore = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tBuyer Balance Before Approval: ${buyerBalanceBefore.toString()}`);

      // Approve the lottery contract to spend the buyer's tokens
      await mockToken.connect(signers[2]).approve(lottery.target, ticketsPrice);

      // Log the buyer's balance after approval
      const buyerBalanceAfter = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tBuyer Balance After Approval: ${buyerBalanceAfter.toString()}`);

      // Buy 5 tickets
      await lottery.connect(signers[2]).buyTickets(mockToken.target, 5);

      const updatedLotteryData = await lottery.lotteries(mockToken.target);
      const participants = await lottery.getParticipants(mockToken.target);
      console.log(`\t\t\t\t\tParticipants: ${participants.length}`);
      console.log(`\t\t\t\t\tPrize Pool: ${updatedLotteryData.prizePool.toString()}`);
      console.log(`\t\t\t\t\tTotal Burned: ${updatedLotteryData.totalBurned.toString()}`);

      // Check that the participant was added
      expect(participants.length).to.equal(5); // Check that 5 participants are added
      expect(updatedLotteryData.prizePool).to.equal((Number(oneTicketPrice) * 2).toString()); // 50% goes to the prize pool
      expect(updatedLotteryData.totalBurned).to.equal((Number(oneTicketPrice) * 2).toString()); // 50% goes to burning
    });

    it("Should revert if not enough tokens are approved", async function () {
      const { lottery, mockToken, signers } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      await lottery.createLottery(mockToken.target, duration, ticketPrice);

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets
      await mockToken.transfer(signers[2].address, ticketPrice); // Transfer only 1 token

      // Approve only 1 token for spending
      await mockToken.connect(signers[2]).approve(lottery.target, ticketPrice);

      // Try to buy 2 tickets (should revert)
      await expect(
        lottery.connect(signers[2]).buyTickets(mockToken.target, 2)
      ).to.be.revertedWith("Insufficient allowance");
    });
  });
});
