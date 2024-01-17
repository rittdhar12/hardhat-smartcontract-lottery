const { ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const deployer = (await getNamedAccounts()).deployer;
    const chainId = network.config.chainId;
    log(`Chain Id: ${chainId}`);
    // const contracts = await deployments.fixture(["all"]);
    // const signer = await ethers.getSigner(deployer);
    // const raffleAddress = contracts["Raffle"].address;
    let vrfCoordinatorV2address, subscriptionId;
    if (developmentChains.includes(network.name)) {
        //const VRFCoordinatorV2Mock = await ethers.getConractAt("Raffle", raffleAddress, signer);
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);

        vrfCoordinatorV2address = vrfCoordinatorV2Mock.target;
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.logs[0].args.subId;
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
        waitConfirmations: network.config.blockConfirmations || 1,
    });

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        await vrfCoordinatorV2Mock.addConsumer(Number(subscriptionId), raffle.target);
    }
    log(``)

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(raffle.address, args);
    }
    log("-------------------------------------");
};

module.exports.tags = ["all", "raffle"];
