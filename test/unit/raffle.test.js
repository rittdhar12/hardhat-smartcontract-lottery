const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
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

          describe("constructor", function () {
              it("initislizes the raffle correctly", async function () {
                  // Ideally we make out tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState();
                  const interval = await raffle.getInterval();
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", function () {
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

          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      Number(interval.toString()) + 1,
                  ]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(new Uint8Array());
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("return false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval.toString()) + 1,
                  ]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall(new Uint8Array());
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("return false if not enough time has passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval.toString()) - 5,
                  ]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall(new Uint8Array());
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("return true if enough time has passed, has player, eth, and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval.toString()) + 1,
                  ]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = raffle.checkUpkeep.staticCall(new Uint8Array());
                  //const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval.toString()) + 1,
                  ]);
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
                  assert(raffleState.toString() == "1");
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
                  const startingIndex = 1;
                  let startingBalance;
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      const accountConnectedRaffle = raffleContract.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startTimeStamp = await raffle.getLatestestTimeStamp();

                  // performUpkeep (mock being chainlink automation)
                  // fulfillRandomWords(mocks being the Chainlink VRF)
                  // We will have to wait for the fulfillRandomWords to be called
                  // Create a new promise
                  await new Promise(async function (resolve, reject) {
                      raffle.once("WinnerPicked", async function () {
                          console.log("Winner Picked event Fired!");
                          try {
                              //console.log(recentWinner);
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerBalance = await ethers.provider.getBalance(accounts[1]);
                              const endingTimeStamp = await raffle.getLatestestTimeStamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startTimeStamp);
                              //assert.equal(recentWinner.toString(), accounts[1].address);
                              assert.equal(
                                  Number(ethers.formatEther(winnerBalance)).toString(),
                                  (
                                      Number(ethers.formatEther(startingBalance)) +
                                      Number(ethers.formatEther(raffleEntranceFee)) * additionalEntrances +
                                      Number(ethers.formatEther(raffleEntranceFee))
                                  ).toString(),
                              );

                              resolve();
                          } catch (error) {
                              reject(error);
                          }
                      });
                      try {
                          const transaction = await raffle.performUpkeep("0x");
                          const transactionReceipt = await transaction.wait(1);
                          startingBalance = await ethers.provider.getBalance(accounts[1]);
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
