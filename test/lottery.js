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
    const mockToken = await mockFactory.deploy('MOCK1', 'Mock token', ethers.parseEther('10000000'));

    return { lottery, signers, BearToken, mockToken, creationFee, buyFee, mockFactory };
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
      const tx = await lottery.connect(signers[2]).createLottery(
        mockToken.target,
        duration,
        ticketPrice,
        signers[2].address,
        { value: creationFee }
      );
      await tx.wait(1);

      // Fetch lottery data using the new lottery ID system (lotteryCounter starts from 0)
      const lotteryId = 0; // The first lottery should have ID 0
      const lotteryData = await lottery.getLotteryData(lotteryId);

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

      // Assertions for the lottery data
      expect(lotteryData.tokenAddress).to.equal(mockToken.target);
      expect(lotteryData.ticketPrice).to.equal(ticketPrice);
      expect(lotteryData.roundDuration).to.equal(duration);
      expect(lotteryData.reserveReceiver).to.equal(signers[2].address);
    });

    it("Should allow creating multiple lotteries for the same token", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // First lottery creation
      await lottery.connect(signers[2]).createLottery(
        mockToken.target,
        duration,
        ticketPrice,
        signers[2].address,
        { value: creationFee }
      );

      const lotteryData1 = await lottery.getLotteryData(0); // First lottery ID should be 0
      console.log(`\t\t\t\t\tFirst Lottery ID 0 created. Token Address: ${lotteryData1.tokenAddress}`);
      console.log(`\t\t\t\t\tFirst Lottery ID 0 created. Token symbol: ${lotteryData1.tokenSymbol}`);

      // Second lottery creation for the same token
      await lottery.connect(signers[3]).createLottery(
        mockToken.target,
        duration,
        ticketPrice,
        signers[3].address,
        { value: creationFee }
      );

      const lotteryData2 = await lottery.getLotteryData(1); // Second lottery ID should be 1
      console.log(`\t\t\t\t\tSecond Lottery ID 1 created. Token Address: ${lotteryData2.tokenAddress}`);
      console.log(`\t\t\t\t\tSecond Lottery ID 1 created. Token Symbol: ${lotteryData2.tokenSymbol}`);


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
      const ticketsPrice = (BigInt(ticketPrice) * 5n).toString(); // Buying 5 tickets
      const buyFee = await lottery.buyFee();

      // Ensure lottery and mockToken are correctly deployed
      console.log(`\t\t\t\t\tLottery Contract Address: ${lottery.target}`);
      console.log(`\t\t\t\t\Mock Token Contract Address: ${mockToken.target}`);

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, signers[2].address, { value: creationFee });

      // Log the ticket price set in the contract
      const lotteryData = await lottery.getLotteryData(0); // Adjust for new lottery ID system (first lottery = ID 0)
      console.log(`\t\t\t\t\tOne Ticket Price: ${ethers.formatUnits(lotteryData.ticketPrice, 18)}`);

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets
      await mockToken.transfer(signers[2].address, ticketsPrice);

      // Log the buyer's balance before approval
      const buyerBalanceBefore = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tBuyer Balance Before Approval: ${ethers.formatUnits(buyerBalanceBefore, 18)}`);

      // Approve the lottery contract to spend the buyer's tokens
      await mockToken.connect(signers[2]).approve(lottery.target, ticketsPrice);

      // Log the buyer's balance after approval
      const buyerBalanceAfter = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tBuyer Balance After Approval: ${ethers.formatUnits(buyerBalanceAfter, 18)}`);

      // Buy 5 tickets
      await lottery.connect(signers[2]).buyTickets(0, 5, { value: buyFee });

      // Get updated lottery data
      const updatedLotteryData = await lottery.getLotteryData(0);
      const participants = await updatedLotteryData.participants;
      const reserveFundBalance = await ethers.provider.getBalance(await lottery.reserveFund());

      // Log the number of participants
      console.log(`\t\t\t\t\tParticipants: ${participants.length}`);

      // Log the updated prize pool and total burned
      console.log(`\t\t\t\t\tPrize Pool: ${ethers.formatUnits(updatedLotteryData.prizePool, 18)}`);
      console.log(`\t\t\t\t\tTotal Burned: ${ethers.formatUnits(updatedLotteryData.totalBurned, 18)}`);

      // Log the updated buyFeePool
      console.log(`\t\t\t\t\tBuy Fee Pool: ${ethers.formatUnits(updatedLotteryData.buyFeePool, 18)}`);

      // Log the reserve fund balance after the ticket purchase
      console.log(`\t\t\t\t\tReserve Fund Balance: ${ethers.formatUnits(reserveFundBalance, 18)}`);

      // Check that the participant count is correct
      expect(participants.length).to.equal(5); // Ensure the participant is only added once despite 5 tickets being bought

      // Check prize pool, burned tokens, and buy fee pool are updated correctly
      expect(updatedLotteryData.prizePool).to.equal((BigInt(ticketPrice) * 5n * 40n / 100n).toString()); // 50% goes to prize pool
      expect(updatedLotteryData.totalBurned).to.equal((BigInt(ticketPrice) * 5n * 40n / 100n).toString()); // 50% goes to burning

      // Verify that the buyFee was correctly accumulated in buyFeePool
      expect(updatedLotteryData.buyFeePool).to.equal(buyFee.toString()); // Ensure the buy fee is accumulated in buyFeePool
    });

    it("Should revert if not enough tokens are approved", async function () {
      const { lottery, mockToken, signers, creationFee } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token
      const buyFee = await lottery.buyFee();

      // Create the lottery
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });

      // Transfer tokens to the buyer (signers[2]) for purchasing tickets
      await mockToken.transfer(signers[2].address, ticketPrice); // Transfer only 1 token

      // Approve only 1 token for spending
      await mockToken.connect(signers[2]).approve(lottery.target, ticketPrice);

      // Try to buy 2 tickets (should revert)
      await expect(
        lottery.connect(signers[2]).buyTickets(0, 2, { value: buyFee })
      ).to.be.revertedWith("Insufficient allowance");
    });
  });
  describe("Draw Winner", function () {

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
      await lottery.connect(signers[2]).buyTickets(0, 5, { value: buyFee });

      // Fetch the prize pool before drawing
      const lotteryDataBefore = await lottery.getLotteryData(0); // Fetch lottery data using the lottery ID
      const prizePoolBefore = lotteryDataBefore.prizePool;
      console.log(`\t\t\t\t\tPrize Pool Before Draw: ${ethers.formatUnits(prizePoolBefore, 18)}`);

      // Get winner's balance before draw
      const winnerBalanceBefore = await mockToken.balanceOf(signers[2].address);
      console.log(`\t\t\t\t\tWinner Balance Before Draw: ${ethers.formatUnits(winnerBalanceBefore, 18)}`);

      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(0);

      // Get updated lottery data and winner's balance after draw
      const lotteryDataAfter = await lottery.getLotteryData(0);
      const winnerBalanceAfter = await mockToken.balanceOf(signers[2].address);

      console.log(`\t\t\t\t\tNew Prize Pool: ${ethers.formatUnits(lotteryDataAfter.prizePool, 18)}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${ethers.formatUnits(winnerBalanceAfter, 18)}`);

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
        await lottery.connect(signers[i]).buyTickets(0, 1, { value: buyFee });
      }

      // Log the number of participants before the draw
      const participants = await lottery.getParticipants(0);
      console.log(`\t\t\t\t\tNumber of Participants: ${participants.length}`);

      // Ensure 100 participants are added
      expect(participants.length).to.equal(100);

      // Fast-forward time to end the lottery round
      await time.increase(duration);

      // Draw the winner
      await lottery.drawWinner(0);

      // Fetch updated lottery data
      const lotteryDataAfter = await lottery.getLotteryData(0);
      const prizePoolAfter = lotteryDataAfter.prizePool;

      // Get the winner's address after the draw
      const lastWinner = lotteryDataAfter.lastWinner; // Assuming you have a getter for lastWinner
      const winnerBalanceAfter = await mockToken.balanceOf(lastWinner);

      console.log(`\t\t\t\t\tLast Winner Address: ${lastWinner}`);
      console.log(`\t\t\t\t\tWinner Balance After Draw: ${ethers.formatUnits(winnerBalanceAfter, 18)}`);

      // Ensure the winner is one of the participants
      expect(participants).to.include(lastWinner);
    });
  });

  describe("Lottery Token Tracking", function () {
    this.timeout(600000);

    it("Should track tokens associated with lotteries by address and symbol", async function () {
      const { lottery, mockToken, signers, creationFee, mockFactory } = await loadFixture(deploy);
      const duration = 3600; // 1 hour
      const ticketPrice = ethers.parseUnits("1", 18); // 1 token

      // Create the first lottery
      console.log("\t\t\t\t\tCreating first lottery...");
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });
      console.log(`\t\t\t\t\tFirst lottery created with token: ${mockToken.target}`);

      // Ensure the token is added to lotteryTokens after the first lottery
      let lotteryTokens = await lottery.getLotteryTokens();
      console.log(`\t\t\t\t\tCurrent lotteryTokens after first lottery: ${lotteryTokens}`);
      expect(lotteryTokens).to.include(mockToken.target); // Check if mockToken is included

      // Check lotteriesByCreator mapping for the creator's lotteries
      const creatorLotteries = await lottery.getLotteriesByCreator(signers[0].address);
      console.log(`\t\t\t\t\tCreator lotteries after first creation: ${creatorLotteries}`);
      expect(creatorLotteries).to.have.lengthOf(1); // Only one lottery created by signers[0]
      expect(creatorLotteries[0]).to.equal(0); // The ID of the first lottery created is 0

      // Create a second lottery with the same token
      console.log("\t\t\t\t\tCreating second lottery with the same token...");
      await lottery.createLottery(mockToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });
      console.log(`\t\t\t\t\tSecond lottery created with token: ${mockToken.target}`);

      // Check lotteryTokens again; it should still only contain the token once
      lotteryTokens = await lottery.getLotteryTokens();
      console.log(`\t\t\t\t\tCurrent lotteryTokens after second lottery: ${lotteryTokens}`);
      expect(lotteryTokens).to.include(mockToken.target); // Still should include mockToken
      expect(lotteryTokens.length).to.equal(1); // Ensure no duplicates

      // Check lotteriesByCreator mapping after second lottery creation
      const updatedCreatorLotteries = await lottery.getLotteriesByCreator(signers[0].address);
      console.log(`\t\t\t\t\tCreator lotteries after second creation: ${updatedCreatorLotteries}`);
      expect(updatedCreatorLotteries).to.have.lengthOf(2); // Now two lotteries created by signers[0]

      // Create a second token for another lottery
      console.log("\t\t\t\t\tDeploying another token...");
      const anotherToken = await mockFactory.deploy("Another Token", "ANOTHER", 18); // Deploy mock token
      console.log(`\t\t\t\t\tAnother token deployed: ${anotherToken.target}`);

      // Create a lottery with another token
      console.log("\t\t\t\t\tCreating lottery with another token...");
      await lottery.createLottery(anotherToken.target, duration, ticketPrice, ethers.ZeroAddress, { value: creationFee });
      console.log(`\t\t\t\t\tLottery created with another token: ${anotherToken.target}`);

      // Check lotteryTokens to ensure it includes both tokens
      lotteryTokens = await lottery.getLotteryTokens();
      console.log(`\t\t\t\t\tCurrent lotteryTokens after creating lottery with another token: ${lotteryTokens}`);
      expect(lotteryTokens).to.include(mockToken.target); // Check if mockToken is included
      expect(lotteryTokens).to.include(anotherToken.target); // Check if anotherToken is included
      expect(lotteryTokens.length).to.equal(2); // Ensure we now have two distinct tokens

      // Check lotteriesByTokenAddress mapping for the first token
      const tokenLotteriesByAddress = await lottery.getLotteriesByTokenAddress(mockToken.target);
      console.log(`\t\t\t\t\tLotteries associated with mockToken by address: ${tokenLotteriesByAddress}`);
      expect(tokenLotteriesByAddress).to.have.lengthOf(2); // Two lotteries should be associated with mockToken by address

      // Check lotteriesByTokenSymbol mapping for the first token
      const tokenLotteriesBySymbol = await lottery.getLotteriesByTokenSymbol(await mockToken.symbol());
      console.log(`\t\t\t\t\tLotteries associated with mockToken by symbol: ${tokenLotteriesBySymbol}`);
      expect(tokenLotteriesBySymbol).to.have.lengthOf(2); // Two lotteries should be associated with mockToken by symbol

      // Check lotteriesByTokenAddress mapping for the second token
      const anotherTokenLotteriesByAddress = await lottery.getLotteriesByTokenAddress(anotherToken.target);
      console.log(`\t\t\t\t\tLotteries associated with anotherToken by address: ${anotherTokenLotteriesByAddress}`);
      expect(anotherTokenLotteriesByAddress).to.have.lengthOf(1); // Only one lottery should be associated with anotherToken

      // Check lotteriesByTokenSymbol mapping for the second token
      const anotherTokenLotteriesBySymbol = await lottery.getLotteriesByTokenSymbol(await anotherToken.symbol());
      console.log(`\t\t\t\t\tLotteries associated with anotherToken by symbol: ${anotherTokenLotteriesBySymbol}`);
      expect(anotherTokenLotteriesBySymbol).to.have.lengthOf(1); // Only one lottery should be associated with anotherToken by symbol

      // Check allLotteries to ensure it contains all created lotteries
      const allCreatedLotteries = await lottery.getAllLotteries();
      console.log(`\t\t\t\t\tAll created lotteries: ${allCreatedLotteries}`);
      expect(allCreatedLotteries).to.have.lengthOf(3); // Total of three lotteries created

      console.log(`\t\t\t\t\tFinal lotteryTokens: ${lotteryTokens}`);
    });
  });











});
