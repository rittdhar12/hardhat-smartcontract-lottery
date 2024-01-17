const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, player, interval;

          beforeEach(async function () {
              accounts = await ethers.getSigners();
              player = accounts[1];
              raffleContract = await ethers.getContract("Raffle");
              raffle = raffleContract.connect(player);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("Works with live chainlink automation and VRF, get a random winner", async function () {
                  // enter the raffle
                  const startTimeStamp = await raffle.getLatestestTimeStamp();
                  // Setup Listener before we enter the raffle
                  // Just in case the blockchain moves really fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async function () {
                          console.log("WinnerPicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance = ethers.provider.getBalance(accounts[0]);
                              const endingTimeStamp = await raffle.getLatestestTimeStamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString, accounts[0].address);
                              assert.equal(raffleState.toString(), "0");
                              assert.equal(
                                  (winnerEndingBalance).toString(),
                                  (winnerStartingBalance + raffleEntranceFee).toString(),
                              );
                              assert(endingTimeStamp > start);
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                  });

                  // Enter Raffle
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const winnerStartingBalance = ethers.provider.getBalance(accounts[0]);

                  //Code wont complete until our listener has finished listening
              });
          });
      });
