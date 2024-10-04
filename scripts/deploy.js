// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function deploy() {
  // Contracts are deployed using the first signer/account by default
  const signers = await ethers.getSigners();

  const lotteryFactory = await ethers.getContractFactory("MultiTokenLottery");
  const bearTokenFactory = await ethers.getContractFactory("FuckTheBears");
  const mockFactory = await ethers.getContractFactory("MyToken");

  // Set signers[1] as the reserveFund
  const creationFee = ethers.parseEther("200000");
  const buyFee = ethers.parseEther("10000");

  const lottery = await lotteryFactory.deploy(signers[1].address);
  console.log("MultiTokenLottery deployed to:", lottery.target);
  console.log("Reserve fund address (signer[1]):", signers[1].address);

  const sBurn = await mockFactory.deploy('Super Burn', 'sBURN', ethers.parseEther('10000000'));
  console.log("Super Burn Token deployed to:", sBurn.target);

  const FUCK = await mockFactory.deploy('Fuck Token', '$FUCK', ethers.parseEther('10000000'));
  console.log("Fuck Token deployed to:", FUCK.target);

  const mockToken = await mockFactory.deploy('Pulse Burn', 'BURN', ethers.parseEther('10000000'));
  console.log("Pulse Burn Token deployed to:", mockToken.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
deploy().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
