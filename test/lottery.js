const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
//const { ethers } = require("ethers")

describe.only("Multi Token Lottery", function () {
  async function deploy() {
    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();

    const lotteryFactory = await ethers.getContractFactory("MultiTokenLottery");
    const bearTokenFactory = await ethers.getContractFactory("FuckTheBears");
    const mockFactory = await ethers.getContractFactory("MyToken");

    // Set signers[1] as the reserveFund
    const creationFee = ethers.parseEther("150000")
    const lottery = await lotteryFactory.deploy(signers[1].address, creationFee);
    const BearToken = await bearTokenFactory.deploy('BEARTOKEN', 'BEAR', signers[0]);
    const mockToken = await mockFactory.deploy();

    return { lottery, signers, BearToken, mockToken, creationFee };
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
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
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
      const { lottery, mockToken, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      await lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee });

      await expect(
        lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee })
      ).to.be.revertedWith("Lottery already exists for this token");
    });
  });

  describe("Ticket Purchasing", function () {
    it("Should allow users to buy tickets", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token
      const ticketsPrice = (Number(ticketPrice) * 5).toString(); // buying 5

      // Ensure lottery and mockToken are correctly deployed
      console.log(`\t\t\t\t\tLottery Contract Address: ${lottery.target}`);
      console.log(`\t\t\t\t\tBear Token Contract Address: ${mockToken.target}`);

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee });

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
      expect(updatedLotteryData.prizePool).to.equal((Number(ticketPrice) * 2).toString()); // 50% goes to the prize pool
      expect(updatedLotteryData.totalBurned).to.equal((Number(ticketPrice) * 2).toString()); // 50% goes to burning
    });

    it("Should revert if not enough tokens are approved", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      await lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee });

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

  describe("Draw Winner", function () {
    this.timeout(600000);
    it("Should draw a winner and balance should match prize pool", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee });

      // Transfer tokens and approve
      const totalTickets = ethers.parseUnits("5", 18); // 5 tickets
      await mockToken.transfer(signers[2].address, totalTickets);
      await mockToken.connect(signers[2]).approve(lottery.target, totalTickets);

      // Buy 5 tickets
      await lottery.connect(signers[2]).buyTickets(mockToken.target, 5);

      // Fetch the prize pool before drawing
      const lotteryDataBefore = await lottery.lotteries(mockToken.target);
      const prizePoolBefore = lotteryDataBefore.prizePool;
      console.log(`\t\t\t\t\tPrize Pool Before Draw: ${prizePoolBefore.toString()}`);

      // Get winner's balance before draw
      const winnerBalanceBefore = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tWinner Balance Before Draw: ${winnerBalanceBefore.toString()}`);

      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(mockToken.target);

      // Get updated lottery data and winner's balance after draw
      const lotteryDataAfter = await lottery.lotteries(mockToken.target);
      const winnerBalanceAfter = await mockToken.balanceOf(signers[2].address);
      const lastWinner = await lottery.getLastWinner(mockToken.target);

      console.log(`\t\t\t\t\tLast Winner Address: ${lastWinner}`);
      console.log(`\t\t\t\t\tNew Prize Pool: ${lotteryDataAfter.prizePool}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${winnerBalanceAfter.toString()}`);

      // Check if the prize pool is reset and the winner is set
      expect(lastWinner).to.equal(signers[2].address);
      expect(lotteryDataAfter.prizePool).to.equal(0);

      // Confirm the winner's balance increased by the prize pool amount
      const balanceChange = Number(winnerBalanceAfter) - Number(winnerBalanceBefore);
      console.log(`\t\t\t\t\tBalance Change: ${balanceChange.toString()}`);

      //expect(balanceChange).to.equal(prizePoolBefore);
    });

    it("Should handle 100 participants correctly", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, { value: creationFee });

      const lotteryDataBefore = await lottery.lotteries(mockToken.target);
      const prizePoolBefore = lotteryDataBefore.prizePool;
      const burnedAmountBefore = lotteryDataBefore.totalBurned;

      console.log(`\t\t\t\t\tPrize Pool Before Draw: ${ethers.formatEther(prizePoolBefore.toString())}`);
      console.log(`\t\t\t\t\tBurned Amount Before Draw: ${ethers.formatEther(burnedAmountBefore.toString())}`);

      // Check reserve fund balance before draw
      const reserveFundBefore = await mockToken.balanceOf(signers[1].address);
      console.log(`\t\t\t\t\tReserve Fund Balance Before Draw: ${ethers.formatEther(reserveFundBefore.toString())}`);

      // Have 100 signers buy tickets
      for (let i = 0; i < 100; i++) {
        const totalTickets = ticketPrice; // 1 ticket per signer
        await mockToken.transfer(signers[i].address, totalTickets);
        await mockToken.connect(signers[i]).approve(lottery.target, totalTickets);
        await lottery.connect(signers[i]).buyTickets(mockToken.target, 1);
      }

      // Log the number of participants before the draw
      const participants = await lottery.getParticipants(mockToken.target);
      console.log(`\t\t\t\t\tNumber of Participants: ${participants.length}`);

      const totalTickets = await lottery.getTotalTickets(mockToken.target);
      console.log(`\t\t\t\t\tNumber of  Tickets: ${totalTickets}`);

      // Ensure 100 participants are added
      expect(participants.length).to.equal(100);

      // Fetch lottery data before drawing


      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(mockToken.target);

      // Get the last winner and their balance after the draw
      const lastWinner = await lottery.getLastWinner(mockToken.target);
      const winnerBalanceAfter = await mockToken.balanceOf(lastWinner);

      console.log(`\t\t\t\t\tLast Winner Address: ${lastWinner}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${ethers.formatEther(winnerBalanceAfter.toString())}`);

      // Fetch updated lottery data and reserve fund after draw
      const lotteryDataAfter = await lottery.lotteries(mockToken.target);
      const burnedAmountAfter = lotteryDataAfter.totalBurned;
      const reserveFundAfter = await mockToken.balanceOf(signers[1].address);

      console.log(`\t\t\t\t\tBurned Amount After Draw: ${ethers.formatEther(burnedAmountAfter.toString())}`);
      console.log(`\t\t\t\t\tReserve Fund Balance After Draw: ${ethers.formatEther(reserveFundAfter.toString())}`);

      // Ensure the winner is one of the participants
      expect(participants).to.include(lastWinner);

      // Ensure that burned amount and reserve fund increased correctly
      expect(burnedAmountAfter).to.be.gt(burnedAmountBefore);
      expect(reserveFundAfter).to.be.gt(reserveFundBefore);
    });

  });



});
