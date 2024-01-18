// const { ethers, network } = require("hardhat");
// const { developmentChains, networkConfig } = require("../helper-hardhat-config");
// const { verify } = require("../utils/verify");

// const VRF_SUB_FUND_AMOUNT = ethers.parseEther("1");

// module.exports = async function ({ getNamedAccounts, deployments }) {
//     const { deploy, log } = deployments;
//     const deployer = await getNamedAccounts();
//     const chainId = network.config.chainId;
//     log(`Chain Id: ${chainId}`);
//     // const contracts = await deployments.fixture(["all"]);
//     // const signer = await ethers.getSigner(deployer);
//     // const raffleAddress = contracts["Raffle"].address;
//     let vrfCoordinatorV2address, subscriptionId, vrfCoordinatorV2Mock;

//     if (developmentChains.includes(network.name)) {
//         //const VRFCoordinatorV2Mock = await ethers.getConractAt("Raffle", raffleAddress, signer);
//         vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
//         vrfCoordinatorV2address = vrfCoordinatorV2Mock.target;
//         const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
//         const transactionReceipt = await transactionResponse.wait();
//         subscriptionId = transactionReceipt.logs[0].args.subId;
//         // Fund the subscription
//         // Usually you need the link token on a real network
//         await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
//     } else {
//         vrfCoordinatorV2address = networkConfig[chainId]["vrfCoordinatorV2"];
//         subscriptionId = networkConfig[chainId]["subscriptionId"];
//     }

//     log(`----------------------------------------------------`);
//     const entranceFee = networkConfig[chainId]["entranceFee"];
//     const gasLaneKeyHash = networkConfig[chainId]["gasLaneKeyHash"];
//     const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
//     const interval = networkConfig[chainId]["interval"];
//     const args = [
//         vrfCoordinatorV2address,
//         subscriptionId,
//         gasLaneKeyHash,
//         interval,
//         entranceFee,
//         callbackGasLimit,

//     ];
//     log(`Args: ${args}`)
//     const raffle = await deploy("Raffle", {
//         from: deployer.target,
//         args: args,
//         logs: true,
//         waitConfirmations: network.config.blockConfirmations || 1,
//     });

//     log("Raffle Working")
//     if (developmentChains.includes(network.name)) {
//         const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
//         await vrfCoordinatorV2Mock.addConsumer(Number(subscriptionId), raffle.target);
//     }
//     log(`Working`)

//     if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
//         log("Verifying...");
//         await verify(raffle.target, args);
//     }
//     log("-------------------------------------");
// };

// module.exports.tags = ["all", "raffle"];

const { network, ethers } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const FUND_AMOUNT = ethers.parseEther("1"); // 1 Ether, or 1e18 (10^18) Wei

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;

    if (chainId == 31337) {
        // create VRFV2 Subscription
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target;
        console.log(`VRF Address : ${vrfCoordinatorV2Address}`);
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait();
        subscriptionId = transactionReceipt.logs[0].args.subId;
        // Fund the subscription
        // Our mock makes it so we don't actually have to worry about sending fund
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    log("----------------------------------------------------");
    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLaneKeyHash = networkConfig[chainId]["gasLaneKeyHash"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLaneKeyHash,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    log(`args: ${args}`)
    log(`deployer target: ${deployer}`)

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    });

    // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
    }

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(raffle.target, arguments);
    }

    log("Enter lottery with command:");
    const networkName = network.name == "hardhat" ? "localhost" : network.name;
    log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`);
    log("----------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
