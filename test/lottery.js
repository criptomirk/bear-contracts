const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");


describe.only("lottery", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploy() {

    // Contracts are deployed using the first signer/account by default
    const signers = await ethers.getSigners();

    const lotteryFaxtory = await ethers.getContractFactory("MultiTokenLottery");
    const bearToken = await ethers.getContractFactory("FuckTheBears")

    const lottery = await lotteryFaxtory.deploy();

    return { lottery, signers };
  }

  describe("Deployment", function () {
    it("Should set the right deploy", async function () {
      this.timeout(600000);
      const { lottery, } = await loadFixture(deploy);
      console.log(` Lottery contract address: ${lottery.target}`)
    });
  });


});
