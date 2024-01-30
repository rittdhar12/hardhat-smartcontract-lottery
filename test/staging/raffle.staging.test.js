const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, deployer;

          beforeEach(async function () {
              //player = accounts[1];
              deployer = (await getNamedAccounts()).deployer;
              raffle = await ethers.getContract("Raffle", deployer);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("Works with live chainlink automation and VRF, get a random winner", async function () {
                  // enter the raffle
                  const startTimeStamp = await raffle.getLatestestTimeStamp();
                  console.log("Setting up test");
                  const accounts = await ethers.getSigners();
                  // Setup Listener before we enter the raffle
                  // Just in case the blockchain moves really fast
                  console.log("Setting up Listener...");
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async function() {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffle.getLatestestTimeStamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString, accounts[0].address);
                              assert.equal(raffleState.toString(), "0");
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + raffleEntranceFee).toString(),
                              );
                              assert(endingTimeStamp > startTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      // Enter Raffle
                      //entering the raffle
                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });

                      await tx.wait(1);
                      console.log("Time to wait...");
                      //const winnerStartingBalance = await accounts[0].getBalance()
                      //console.log(`Winner Starting Balance: ${winnerStartingBalance}`)
                      console.log("Listening to new promise...");
                      //Code won't complete until listener is done

                      //Code wont complete until our listener has finished listening
                  });
              });
          });
      });
