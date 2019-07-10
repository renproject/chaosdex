import * as React from "react";

import { ReactComponent as Logo } from "../../../styles/images/logo.svg";
import { ReactComponent as MetaMask } from "../../../styles/images/metamask.svg";

export const DOCS_LINK = "https://docs.renproject.io/ren/";
export const BUILD_LINK = "https://docs.renproject.io/developers";
export const FAQ_LINK = "https://renproject.zendesk.com/hc/en-us";

type TutorialPage = React.StatelessComponent<{
    nextPage: () => void;
    previousPage: () => void;
}>;

// Custom `div`s to make it easier to read the page content.
const Page = (props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => <div {...props} className="tutorial--page">{props.children}</div>;
const Body = (props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => <div {...props} className="tutorial--page--body">{props.children}</div>;
const Buttons = (props: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => <div {...props} className="tutorial--page--buttons">{props.children}</div>;

const Welcome: TutorialPage = ({ nextPage }) => {
    return <Page>
        <Body>
            <Logo />
            <h2>Welcome to the RenVM Demo</h2>
            <p>Ren is an open protocol that enables the permissionless and private transfer of value between any blockchain</p>
        </Body>
        <Buttons>
            <span />{/* Counter-weight for the Next button */}
            <button className="button" onClick={nextPage}>Next</button>
        </Buttons>
    </Page>;
};

const Overview: TutorialPage = ({ nextPage, previousPage }) => {
    return <Page>
        <Body>
            <h2>Overview</h2>
            <p>The RenVM Testnet Demo is a simple DEX the team created to showcase interoperability facilitated by RenVM.</p>
            <p>Users will be able to exchange (testnet) DAI & BTC in a completely trustless, decentralized, and permissionless manner. </p>
            <p>Please note this is a demonstration of our technology and will remain on the Testnet only.</p>
        </Body>
        <Buttons>
            <button className="button--white" onClick={previousPage}>Previous</button>
            <button className="button" onClick={nextPage}>Next</button>
        </Buttons>
    </Page>;
};

const GettingStarted: TutorialPage = ({ nextPage, previousPage }) => {
    return <Page>
        <Body>
            <h2>Let's get started</h2>
            <p>Before you can use the demo, you'll need to:</p>
            <ol>
                <li>Install <a href="#"><MetaMask />MetaMask</a>. MetaMask is a browser extension that allows you to interact with Ethereum apps.</li>
                <li>Send some Kovan Testnet ETH to your MetaMask from a <a href="https://github.com/kovan-testnet/faucet" target="_blank" rel="noopener noreferrer">Kovan ETH Faucet</a>.</li>
                <li>Get some Testnet BTC from a <a href="https://testnet-faucet.mempool.co/" target="_blank" rel="noopener noreferrer">Testnet BTC Faucet</a>. If you don't have a Testnet Bitcoin wallet, skip this step until later.</li>
            </ol>
            {/*<p>make sure you have a Bitcoin wallet that supports the Bitcoin Testnet and some Testnet Bitcoin. You’ll also need a MetaMask wallet and some Testnet Ether. </p>
                <p>For more details on where to acquire these, <a href={FAQ_LINK} target="_blank" rel="noopener noreferrer">head over to the FAQ</a>.</p>
                <p>If you want to find out more about how the demo works, <a href={DOCS_LINK} target="_blank" rel="noopener noreferrer">jump into the technical docs</a>.</p>*/}
        </Body>
        <Buttons>
            <button className="button--white" onClick={previousPage}>Previous</button>
            <button className="button" onClick={nextPage}>Get started</button>
        </Buttons>
    </Page>;
};

export const tutorialPages: Array<{ name: string, node: TutorialPage }> = [
    { name: "Welcome", node: Welcome, },
    { name: "Overview", node: Overview, },
    { name: "Getting started", node: GettingStarted, },
];
