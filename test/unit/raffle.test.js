const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval, player, raffleContract; // deployer
          const chainId = network.config.chainId;

          beforeEach(async function () {
              accounts = await ethers.getSigners();
              player = accounts[1];
              await deployments.fixture(["mocks", "raffle"]);
              //deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);
              raffleContract = await ethers.getContract("Raffle");
              raffle = raffleContract.connect(player);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", async function () {
              it("initislizes the raffle correctly", async function () {
                  // Ideally we make out tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState();
                  const interval = await raffle.getInterval();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", async function () {
              it("reverts when you dont pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered",
                  );
              });

              it("Records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(player.address, playerFromContract);
              });

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  );
              });

              it("Doesnt allow entrance when Raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  // Pretend to be a chainlink automated node
                  await raffle.performUpkeep("0x");
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen",
                  );
              });
          });

          describe("checkUpkeep", async function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("return false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall("0x");
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("return false if not enough time has passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall("0x");
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("return true if enough time has passed, has player, eth, and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall("0x");
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const transaction = await raffle.performUpkeep("0x");
                  assert(transaction);
              });

              it("reverts if checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded",
                  );
              });

              it("Updates the raffle state and emits a requestId", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const transactionResponse = await raffle.performUpkeep("0x");
                  const transactionReceipt = await transactionResponse.wait(1);
                  const raffleState = await raffle.getRaffleState();
                  const requestId = transactionReceipt.logs[1].args.requestId;
                  assert(Number(requestId) > 0);
                  assert(raffleState == 1);
              });
          });
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
              });
              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
                  ).to.be.revertedWith("nonexistent request");
              });
              it("picks a winner, resets and sends money", async function () {
                  const additionalEntrances = 3;
                  const startingIndex = 2;
                  let startingBalance;
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      raffle = raffleContract.connect(accounts[i]);
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startTimeStamp = await raffle.getLatestestTimeStamp();

                  await new Promise(async function (resolve, reject) {
                      raffle.once("WinnerPicked", async function () {
                          console.log("Winner Picked event Fired!");

                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerBalance = await acccount[2].getBalance();
                              const endingTimeStamp = await raffle.getLatestestTimeStamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;

                              assert.equal(recentWinner.toString(), accounts[2].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerBalance.toString(),
                                  (
                                      startingBalance +
                                      raffleEntranceFee * additionalEntrances +
                                      raffleEntranceFee
                                  ).toString(),
                              );
                              assert(endingTimeStamp > startTimeStamp);
                              resolve();
                          } catch (error) {
                              reject(error);
                          }
                      });
                      try {
                          const transaction = await raffle.performUpkeep("0x");
                          const transactionReceipt = await transaction.wait(1);
                          startingBalance = await accounts[2].getBalance();
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              transactionReceipt.logs[1].args.requestId,
                              raffle.target,
                          );
                      } catch (error) {
                          reject(error);
                      }
                  });
              });
          });
      });
