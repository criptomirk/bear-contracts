require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("dotenv").config();

task("printAddresses", "Prints the addresses of multiple accounts")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    console.log("Account addresses:");
    for (let i = 0; i < accounts.length; i++) {
      console.log(accounts[i].address);
    }
  });

module.exports = {
  networks: {
    hardhat: {
      // forking: {
      //   url: process.env.PLSMAIN,
      //   // allowUnlimitedContractSize: true,
      //   // timeout: 90000,
      //   blockNumber: 21327087
      //   //blockNumber: 20570836
      //   //blockNumber: 20969107


      //   // chainId: 1,
      //   // gas: 9000000000000000
      // },
      accounts: {
        count: 1500,
        //558, // Number of accounts
        accountsBalance: "10000000000000000000000000000", // 1B ETH in Wei
        mnemonic: process.env.MNEMONIC
      },

    },
    bsctest: {
      url: "https://data-seed-prebsc-1-s2.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      },
    },
    bscmain: {
      url: "https://bsc-dataseed.bnbchain.org/",
      chainId: 56,
      //gasPrice: ,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      },
    },
    roburna: {
      url: process.env.ROBURNA_URL || 'https://preseed-testnet-1.roburna.com/',
      //accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [process.env.PRIVATE_KEY0,process.env.PRIVATE_KEY1,process.env.PRIVATE_KEY2,process.env.PRIVATE_KEY3,process.env.PRIVATE_KEY4,process.env.PRIVATE_KEY5],
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
        passphrase: "",
      },
      gas: 5603244,
      chainId: 159
    },
    goerli: {
      url: process.env.GOERLI,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
      }
    },
    sepolia: {
      url: process.env.SEPOLIA,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
      },
    },
    opt: {
      url: process.env.OPTIMISM,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
      },

    },
    arb: {
      url: process.env.ARBITRUM,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
      },

    },

    plsmain: {
      url: process.env.PLSMAIN,
      accounts: [process.env.PRIVATE_KEY],
    },

    mainnet: {
      url: process.env.MAIN,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
        passphrase: "",
      },


    }


  },

  etherscan: {

    apiKey: process.env.ETHERSCAN_API_KEY,
    //apiKey: process.env.BSCSCAN_API_KEY
    //apiKey: process.env.ARBITRUM_API_KEY
  },

  solidity: {
    compilers: [

      {
        version: "0.5.13",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },

      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },


      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.8.5",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.7",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          },
          evmVersion: 'paris'
        }
      },
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          },
          evmVersion: 'paris'
        }
      }
    ],

  },

  mocha: {
    // reporter: 'xunit',
    // reporterOptions: {
    //   //output: 'GIVERS_TEST-results.xml'
    // },
    // Exclude specific file(s) from tests
    exclude: [
      './home/steve/Documents/Dapps/entitosidai-contract/test/Lock.js'
    ]
  },

  gasReporter: {
    enabled: true,
    outputFile: "gas-report.txt",
    noColors: true,
    gasPrice: 3,
    currency: "USD",
    //currency: "KES",
    //coinmarketcap: '10dd2305-8865-4931-88e0-f70085c7e5fb'
  }

}