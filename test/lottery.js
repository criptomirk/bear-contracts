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
    const creationFee = ethers.parseEther("200000")
    const buyFee = ethers.parseEther("10000")
    const lottery = await lotteryFactory.deploy(signers[1].address);
    const BearToken = await bearTokenFactory.deploy('BEARTOKEN', 'BEAR', signers[0]);
    const mockToken = await mockFactory.deploy();

    return { lottery, signers, BearToken, mockToken, creationFee, buyFee };
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

      // Check signer[1]'s balance before creation fee transfer
      const signer1BalanceBefore = await ethers.provider.getBalance(signers[1].address);
      console.log(`\t\t\t\t\tSigner[1] Balance Before: ${ethers.formatEther(signer1BalanceBefore)}`);

      // Create a lottery
      const tx = await lottery.connect(signers[2]).createLottery(mockToken.target, duration, ticketPrice, signers[2].address, { value: creationFee });
      tx.wait(1)
      // Check lottery data after creation
      const lotteryData = await lottery.getLotteryData(mockToken.target, 0);

      console.log(`\t\t\t\t\tLottery Token Address: ${lotteryData.tokenAddress}`);
      console.log(`\t\t\t\t\tLottery Ticket Price: ${ethers.formatUnits(lotteryData.ticketPrice, 18)}`);
      console.log(`\t\t\t\t\tLottery Round End Time: ${lotteryData.roundEndTime}`);
      console.log(`\t\t\t\t\tLottery Round Duration: ${lotteryData.roundDuration}`);
      console.log(`\t\t\t\t\tLottery Participants: ${lotteryData.participants.length}`);
      console.log(`\t\t\t\t\tLast Winner: ${lotteryData.lastWinner}`);
      console.log(`\t\t\t\t\tPrize Pool: ${ethers.formatUnits(lotteryData.prizePool, 18)}`);
      console.log(`\t\t\t\t\tTotal Burned: ${ethers.formatUnits(lotteryData.totalBurned, 18)}`);
      console.log(`\t\t\t\t\tBuy Fee Pool: ${ethers.formatUnits(lotteryData.buyFeePool, 18)}`);
      console.log(`\t\t\t\t\tReserve Receiver: ${lotteryData.reserveReceiver}`);

      // Check signer[1]'s balance after creation fee transfer
      const signer1BalanceAfter = await ethers.provider.getBalance(signers[1].address);
      console.log(`\t\t\t\t\tSigner[1] Balance After: ${ethers.formatEther(signer1BalanceAfter)}`);

    });

    it("Should allow creating multiple lotteries for the same token", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // First lottery creation
      await lottery.connect(signers[2]).createLottery(mockToken.target, duration, ticketPrice, signers[2].address, { value: creationFee });

      const lotteryData1 = await lottery.getLotteryData(mockToken.target, 0); // Assuming the first lottery has an ID of 1
      console.log(`\t\t\t\t\tFirst Lottery ID 1 created. Token Address: ${lotteryData1.tokenAddress}`);

      // Second lottery creation for the same token
      await lottery.connect(signers[3]).createLottery(mockToken.target, duration, ticketPrice, signers[3].address, { value: creationFee });

      const lotteryData2 = await lottery.getLotteryData(mockToken.target, 1); // Assuming the second lottery has an ID of 2
      console.log(`\t\t\t\t\tSecond Lottery ID 2 created. Token Address: ${lotteryData2.tokenAddress}`);

      // Verify both lotteries exist and are separate entities
      expect(lotteryData1.tokenAddress).to.equal(mockToken.target);
      expect(lotteryData2.tokenAddress).to.equal(mockToken.target);
      expect(lotteryData1).to.not.deep.equal(lotteryData2); // Ensure the two lotteries are not identical
    });
  });

  describe("Ticket Purchasing", function () {
    it("Should allow users to buy tickets and accumulate buyFee in buyFeePool", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token
      const ticketsPrice = (Number(ticketPrice) * 5).toString(); // buying 5 tickets
      const buyFee = await lottery.buyFee()

      // Ensure lottery and mockToken are correctly deployed
      console.log(`\t\t\t\t\tLottery Contract Address: ${lottery.target}`);
      console.log(`\t\t\t\t\tBear Token Contract Address: ${mockToken.target}`);

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, signers[2].address, { value: creationFee });

      // Log the ticket price set in the contract
      const lotteryData = await lottery.lotteries(mockToken.target, 0);
      console.log(`\t\t\t\t\tOne Ticket Price: ${lotteryData.ticketPrice.toString()}`);

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets
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
      await lottery.connect(signers[2]).buyTickets(mockToken.target, 0, 5, { value: buyFee });

      // Get updated lottery data
      const updatedLotteryData = await lottery.lotteries(mockToken.target, 0);
      const participants = await lottery.getParticipants(mockToken.target, 0);
      const reserveFundBalance = await ethers.provider.getBalance(await lottery.reserveFund());

      // Log the number of participants
      console.log(`\t\t\t\t\tParticipants: ${participants.length}`);

      // Log the updated prize pool and total burned
      console.log(`\t\t\t\t\tPrize Pool: ${updatedLotteryData.prizePool.toString()}`);
      console.log(`\t\t\t\t\tTotal Burned: ${updatedLotteryData.totalBurned.toString()}`);

      // Log the updated buyFeePool
      console.log(`\t\t\t\t\tBuy Fee Pool: ${updatedLotteryData.buyFeePool.toString()}`);

      // Log the reserve fund balance after the tickets purchase
      console.log(`\t\t\t\t\tReserve Fund Balance: ${reserveFundBalance.toString()}`);

      // Check that the participant was added
      expect(participants.length).to.equal(5); // Check that 5 participants are added

      // Check prize pool, burned tokens, and buy fee pool are updated correctly
      expect(updatedLotteryData.prizePool).to.equal((Number(ticketPrice) * 2).toString()); // 50% goes to the prize pool
      expect(updatedLotteryData.totalBurned).to.equal((Number(ticketPrice) * 2).toString()); // 50% goes to burning

      // Verify that the buyFee was correctly accumulated in buyFeePool and sent to the reserve fund
      expect(updatedLotteryData.buyFeePool).to.equal(buyFee.toString()); // Ensure the buy fee is accumulated in buyFeePool
    });


    it("Should revert if not enough tokens are approved", async function () {
      const { lottery, mockToken, signers, creationFee, buyFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets
      await mockToken.transfer(signers[2].address, ticketPrice); // Transfer only 1 token

      // Approve only 1 token for spending
      await mockToken.connect(signers[2]).approve(lottery.target, ticketPrice);

      // Try to buy 2 tickets (should revert)
      await expect(
        lottery.connect(signers[2]).buyTickets(mockToken.target, 0, 2, { value: buyFee })
      ).to.be.revertedWith("Insufficient allowance");
    });

  });

  describe.only("Draw Winner", function () {
    this.timeout(600000);

    it("Should draw a winner and balance should match prize pool", async function () {
      const { lottery, mockToken, signers, creationFee, buyFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });

      // Transfer tokens and approve
      const totalTickets = ethers.parseUnits("5", 18); // 5 tokens
      await mockToken.transfer(signers[2].address, totalTickets);
      await mockToken.connect(signers[2]).approve(lottery.target, totalTickets);

      // Buy 5 tickets
      await lottery.connect(signers[2]).buyTickets(mockToken.target, 0, 5, { value: buyFee });

      // Fetch the prize pool before drawing
      const lotteryDataBefore = await lottery.lotteries(mockToken.target, 0);
      const prizePoolBefore = lotteryDataBefore.prizePool;
      console.log(`\t\t\t\t\tPrize Pool Before Draw: ${prizePoolBefore.toString()}`);

      // Get winner's balance before draw
      const winnerBalanceBefore = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tWinner Balance Before Draw: ${winnerBalanceBefore.toString()}`);

      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(mockToken.target, 0);

      // Get updated lottery data and winner's balance after draw
      const lotteryDataAfter = await lottery.lotteries(mockToken.target, 0);
      const winnerBalanceAfter = await mockToken.balanceOf(signers[2].address);

      console.log(`\t\t\t\t\tNew Prize Pool: ${lotteryDataAfter.prizePool}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${winnerBalanceAfter.toString()}`);


      // Confirm the winner's balance increased by the prize pool amount
      const balanceChange = Number(winnerBalanceAfter) - Number(winnerBalanceBefore);
      console.log(`\t\t\t\t\tBalance Change: ${balanceChange.toString()}`);
      expect(balanceChange).to.equal(Number(prizePoolBefore));

      // Check if the last winner is correctly set
      const lastWinner = lotteryDataAfter.lastWinner; // Assuming you have a getter for lastWinner
      expect(lastWinner).to.equal(signers[2].address); // Ensure that the last winner is the correct address
    });

    it("Should handle 100 participants correctly", async function () {
      const { lottery, mockToken, signers, creationFee, buyFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });

      // Have 100 signers buy tickets
      for (let i = 0; i < 100; i++) {
        const totalTickets = ticketPrice; // 1 ticket per signer
        await mockToken.transfer(signers[i].address, totalTickets);
        await mockToken.connect(signers[i]).approve(lottery.target, totalTickets);
        await lottery.connect(signers[i]).buyTickets(mockToken.target, 0, 1, { value: buyFee });
      }


      // Log the number of participants before the draw
      const participants = await lottery.getParticipants(mockToken.target, 0);
      console.log(`\t\t\t\t\tNumber of Participants: ${participants.length}`);

      // Ensure 100 participants are added
      expect(participants.length).to.equal(100);

      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(mockToken.target, 0);



      // Fetch updated lottery data
      const lotteryDataAfter = await lottery.lotteries(mockToken.target, 0);
      const prizePoolAfter = lotteryDataAfter.prizePool;

      // Get the winner's address after the draw
      const lastWinner = await lotteryDataAfter.lastWinner; // Assuming you have a getter for lastWinner
      const winnerBalanceAfter = await mockToken.balanceOf(lastWinner);

      console.log(`\t\t\t\t\tLast Winner Address: ${lastWinner}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${ethers.formatEther(winnerBalanceAfter.toString())}`);

      // Ensure the winner is one of the participants
      expect(participants).to.include(lastWinner);


    });
  });







});
