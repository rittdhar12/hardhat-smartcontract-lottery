const { ethers, network } = require("hardhat");
const { check } = require("prettier");

async function mockKeepers() {
    const raffle = await ethers.getContract("Raffle");
    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));
    const { upkeepNeeded } = await raffle.callStatic.checkUpKeep(checkData);
    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData);
        const txReceipt = await tx.wait(1);
        const requestId = txReceipt.logs[1].args.requestId;
        console.log(`Performed upkeep with Request ID: ${requestId}`);
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, raffle);
        }
    } else {
        console.log("No upkeep needed!");
    }
}

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok lets pretend ...");
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock, fulfillRandomwords(requestId, raffle.target);
    console.log("Responded");
    const recentWinner = await raffle.getRecentWinner();
    console.log(`The winner is ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });