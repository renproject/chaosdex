import * as React from "react";

import { IS_TESTNET } from "../../../lib/environmentVariables";
import { renderToken, Token } from "../../../state/generalTypes";
import { ReactComponent as Logo } from "../../../styles/images/logo.svg";
import { ReactComponent as MetaMask } from "../../../styles/images/metamask.svg";

export const BUILDWITHRENVM_LINK = "https://renproject.io/developers";
export const READTHEDOCS_LINK = "https://docs.renproject.io/ren/"; // https://docs.renproject.io/developers
export const FAQ_LINK = "https://docs.renproject.io/chaosnet/chaosdex";
export const KOVAN_FAUCET_LINK = "https://github.com/kovan-testnet/faucet";
export const BTC_FAUCET_LINK = "https://bitcoinfaucet.uo1.net/";
export const TAZ_FAUCET_LINK = "https://faucet.zcash.garethtdavies.com/";
export const METAMASK_LINK = "https://metamask.io/";
export const INTEROP_LINK = "https://docs.renproject.io/ren/renvm/universal-interop";

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
            <h2>Welcome to the RenVM {IS_TESTNET ? "Demo" : "ChaosDEX"}</h2>
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
            <p>The RenVM {IS_TESTNET ? "Demo" : "ChaosDEX"} is a DEX built by the Ren team to showcase interoperability facilitated by RenVM.</p>
            <p>Users can exchange {renderToken(Token.DAI)}, {renderToken(Token.BTC)}, {renderToken(Token.ZEC)} & {renderToken(Token.BCH)} in a completely trustless, decentralized, and permissionless manner. </p>
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
                <li>Install <a href={METAMASK_LINK} target="_blank" rel="noopener noreferrer"><MetaMask />MetaMask</a>. MetaMask is a browser extension that allows you to interact with Ethereum apps.</li>
                <li>Get some Testnet BTC from a <a href={BTC_FAUCET_LINK} target="_blank" rel="noopener noreferrer">Testnet BTC Faucet</a>. If you don't have a Testnet Bitcoin wallet, skip this step until later.</li>
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

export const tutorialPages: Array<{ name: string, node: TutorialPage }> = IS_TESTNET ?
    [
        { name: "Welcome", node: Welcome, },
        { name: "Overview", node: Overview, },
        { name: "Getting started", node: GettingStarted }
    ] : [
        { name: "Welcome", node: Welcome, },
        { name: "Overview", node: Overview, },
    ];
