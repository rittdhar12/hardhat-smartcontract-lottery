const { ethers, network } = require("hardhat");
const {
    developmentChains,
    networkConfig,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("1");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    log(`Chain Id: ${chainId}`);
    // const contracts = await deployments.fixture(["all"]);
    // const signer = await ethers.getSigner(deployer);
    // const raffleAddress = contracts["Raffle"].address;
    let vrfCoordinatorV2address, subscriptionId, vrfCoordinatorV2Mock;

    if (developmentChains.includes(network.name)) {
        //const VRFCoordinatorV2Mock = await ethers.getConractAt("Raffle", raffleAddress, signer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2address = vrfCoordinatorV2Mock.target;
        log(`vrf Address: ${vrfCoordinatorV2address}`);
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait();
        subscriptionId = transactionReceipt.logs[0].args.subId;
        log(`Subscription ID: ${subscriptionId}`);
        // Fund the subscription
        // Usually you need the link token on a real network
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    log(`----------------------------------------------------`);
    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLaneKeyHash = networkConfig[chainId]["gasLaneKeyHash"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    const args = [
        vrfCoordinatorV2address,
        entranceFee,
        gasLaneKeyHash,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        logs: true,
        waitConfirmations: waitBlockConfirmations,
    });

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        await vrfCoordinatorV2Mock.addConsumer(Number(subscriptionId), raffle.address);
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(raffle.address, args);
    }
    log("-------------------------------------");
};

module.exports.tags = ["all", "raffle"];
