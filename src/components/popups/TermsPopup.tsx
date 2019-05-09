import * as React from "react";

import { connect, ConnectedReturnType } from "react-redux"; // Custom typings
import { bindActionCreators, Dispatch } from "redux";

import { clearPopup, PopupID } from "../../store/actions/popup/popupActions";
import { agreeToTerms } from "../../store/actions/trader/termsActions";

/**
 * TermsPopup is a popup component for displaying terms and conditions
 */
class TermsPopupClass extends React.Component<Props, State> {
    public constructor(props: Props, context: object) {
        super(props, context);
        this.state = {
            scrollBottom: false,
        };
    }

    /**
     * The main render function.
     * @dev Should have minimal computation, loops and anonymous functions.
     */
    public render(): React.ReactNode {
        const { scrollBottom } = this.state;
        return (
            <div className="popup terms">
                <h2>End User License Agreement</h2>
                <div className="terms--content" onScroll={this.handleScroll}>
                    <p>Please read this EULA carefully, as it sets out the basis upon which we license the Software for use. Before you download the Software from our website, we will ask you to give your express agreement to the provisions of this EULA. By agreeing to be bound by this EULA, you further agree that any person you authorise to use the Software will comply with the provisions of this EULA.</p>
                    <p><b>AGREEMENT</b></p>
                    <ol>
                        <li>
                            Definitions
                            <ol>
                                <li>
                                    Except to the extent expressly provided otherwise, in this EULA:<br />
                                    &ldquo;Dappbase Ventures Limited&rdquo; means the company incorporated in the British Virgin Islands (company number 1959524), with its registered office at Vistra Corporate Services Centre, Wickhams Cay II, Road Town, Tortola, VG 1110, British Virgin Islands;<br />
                                    &ldquo;Documentation&rdquo; means the documentation for the Software produced by the Licensor and delivered or made available by the Licensor to the User;<br />
                                    &ldquo;Effective Date&rdquo; means the date upon which the User gives the User&apos;s express consent to this EULA, following the issue of this EULA by the Licensor;<br />
                                    &ldquo;EULA&rdquo; means this end user licence agreement, including any amendments to this end user licence agreement from time to time;<br />
                                    &ldquo;Fees&rdquo; means the fees imposed on the User by the Licensor as specified on the Licensor’s website at <a href="https://republicprotocol.com/" target="_blank" rel="noopener noreferrer">https://republicprotocol.com/</a>;<br />
                                    &ldquo;Force Majeure Event&rdquo; means an event, or a series of related events, that is outside the reasonable control of the party affected (including failures of the internet or any public telecommunications network, hacker attacks, denial of service attacks, virus or other malicious software attacks or infections, power failures, industrial disputes affecting any third party, changes to the law, disasters, explosions, fires, floods, riots, terrorist attacks and wars);<br />
                                    &ldquo;Intellectual Property Rights&rdquo; means all intellectual property rights wherever in the world, whether registrable or unregistrable, registered or unregistered, including any application or right of application for such rights (and these &ldquo;intellectual property rights&rdquo; include copyright and related rights, database rights, confidential information, trade secrets, know-how, business names, trade names, trademarks, service marks, passing off rights, unfair competition rights, patents, petty patents, utility models, semi-conductor topography rights and rights in designs);<br />
                                    &ldquo;Licensor&rdquo; means Dappbase Ventures Limited (the company that owns the businesses associated with &ldquo;RenEx&rdquo;, and the &ldquo;Republic Protocol&rdquo; trademark name), a company incorporated in the British Virgin Islands (company number 1959524), with its registered office at Vistra Corporate Services Centre, Wickhams Cay II, Road Town, Tortola, VG 1110, British Virgin Islands;<br />
                                    &ldquo;Maintenance Services&rdquo; means the supply to the User and application to the Software of Updates and Upgrades;<br />
                                    &ldquo;Minimum Term&rdquo; means, in respect of this EULA, the period of 12 months beginning on the Effective Date;<br />
                                    &ldquo;Payments&rdquo; means the method for payment of fees imposed on the User by the Licensor as specified on the Licensor’s website at <a href="https://republicprotocol.com/" target="_blank" rel="noopener noreferrer">https://republicprotocol.com/</a>;<br />
                                    &ldquo;RenEx&rdquo; means the software platform provided by the Licensor that facilitates a decentralized dark pool exchange under the &ldquo;Republic Protocol&rdquo; trademark for the trading of digital assets;<br />
                                    &ldquo;Republic Protocol&rdquo; means the trademark name under which the Licensor operates the its platform protocol for the building and operating of decentralized dark pool exchanges, including the RenEx dark pool exchange platform, including all related research, development and commercial activities;<br />
                                    &ldquo;Services&rdquo; means any services that the Licensor provides to the User, or has an obligation to provide to the User, under this EULA;<br />
                                    &ldquo;Software&rdquo; means software relating to the RenEx dark pool platform operated under the Republic Protocol trademark by the Licensor;<br />
                                    &ldquo;Software Defect&rdquo; means a defect, error or bug in the Software having a material adverse effect on the appearance, operation, functionality or performance of the Software, but excluding any defect, error or bug caused by or arising as a result of:
                                    <ol type="a">
                                        <li>any act or omission of the User or any person authorised by the User to use the Software;</li>
                                        <li>any use of the Software contrary to the Documentation by the User or any person authorised by the User to use the Software;</li>
                                        <li>a failure of the User to perform or observe any of its obligations in this EULA; and/or</li>
                                        <li>an incompatibility between the Software and any other system, network, application, program, hardware or software not specified as compatible in the Software Specification;</li>
                                    </ol>
                                    &ldquo;Software Specification&rdquo; means the specification for the Software set out in the Documentation;<br />
                                    &ldquo;Source Code&rdquo; means the Software code in human-readable form or any part of the Software code in human-readable form, including code compiled to create the Software or decompiled from the Software, but excluding interpreted code comprised in the Software;<br />
                                    &ldquo;Support Services&rdquo; means support in relation to the use of the Software and the identification and resolution of errors in the Software, but shall not include the provision of training services whether in relation to the Software or otherwise;<br />
                                    &ldquo;Term&rdquo; means the term of this EULA, commencing in accordance with Clause 3.1 and ending in accordance with Clause 3.2;<br />
                                    &ldquo;Update&rdquo; means a hotfix, patch or minor version update to the Software;<br />
                                    &ldquo;Upgrade&rdquo; means a major version upgrade of the Software;<br />
                                    &ldquo;User&rdquo; means the person to whom the Licensor grants a right to use the Software under this EULA; and<br />
                                    &ldquo;User Indemnity Event&rdquo; has the meaning given to it in Clause 13.1.
                                </li>
                            </ol>
                        </li>
                        <li>
                            Credit
                            <ol>
                                <li>This document was created using a template from SEQ Legal (<a href="https://seqlegal.com" target="_blank" rel="noopener noreferrer">https://seqlegal.com</a>).</li>
                            </ol>
                        </li>
                        <li>
                            Term
                            <ol>
                                <li>This EULA shall come into force upon the Effective Date.</li>
                                <li>This EULA shall continue in force indefinitely, subject to termination in accordance with Clause 15 or any other provision of this EULA.</li>
                            </ol>
                        </li>
                        <li>
                            Licence
                            <ol>
                                <li>
                                    The Licensor hereby grants to the User from the date of supply of the Software to the User until the end of the Term a worldwide, non-exclusive licence to:
                                    <ol type="a">
                                        <li>install the Software; and</li>
                                        <li>use the Software in accordance with the Documentation.</li>
                                    </ol>
                                    subject to the limitations and prohibitions set out and referred to in this Clause 4.
                                </li>
                                <li>The User may not sub-license and must not purport to sub-license any rights granted under Clause 4.1.</li>
                                <li>
                                    Save to the extent expressly permitted by this EULA or required by applicable law on a non-excludable basis, any licence granted under this Clause 4 shall be subject to the following prohibitions:
                                    <ol type="a">
                                        <li>the User must not sell, resell, rent, lease, loan, supply, publish, distribute or redistribute the Software;</li>
                                        <li>the User must not alter, edit or adapt the Software; and</li>
                                        <li>the User must not decompile, de-obfuscate or reverse engineer, or attempt to decompile, de-obfuscate or reverse engineer, the Software.</li>
                                    </ol>
                                </li>
                                <li>The User shall be responsible for the security of copies of the Software supplied to the User under this EULA (or created from such copies) and shall use all reasonable endeavours (including all reasonable security measures) to ensure that access to such copies is restricted to persons authorised to use them under this EULA.</li>
                            </ol>
                        </li>
                        <li>
                            Source Code
                            <ol>
                                <li>Nothing in this EULA shall give to the User or any other person any right to access or use the Source Code or constitute any licence of the Source Code.</li>
                            </ol>
                        </li>
                        <li>
                            Maintenance Services
                            <ol>
                                <li>The Licensor may provide Maintenance Services to the User at its absolute own discretion. The Licensor is under no obligation to the User to provide such Maintenance Services, except as it determines from time to time in line with any technical and/or operational needs it may identify.</li>
                            </ol>
                        </li>
                        <li>
                            Support Services
                            <ol>
                                <li>The Licensor may provide Support Services to the User at its absolute own discretion. The Licensor is under no obligation to the User to provide such Support Services, except as it determines from time to time in line with any technical and/or operational needs it may identify.</li>
                            </ol>
                        </li>
                        <li>
                            No assignment of Intellectual Property Rights
                            <ol>
                                <li>Nothing in this EULA shall operate to assign or transfer any Intellectual Property Rights from the Licensor to the User, or from the User to the Licensor.</li>
                            </ol>
                        </li>
                        <li>
                            Fees
                            <ol>
                                <li>The User shall pay any relevant Fees that may be imposed by the Licensor for the use of its software, as specified on its website at <a href="https://republicprotocol.com/" target="_blank" rel="noopener noreferrer">https://republicprotocol.com/</a></li>
                                <li>All amounts stated in or in relation to this EULA are, unless the context requires otherwise, stated on its website at <a href="https://republicprotocol.com/" target="_blank" rel="noopener noreferrer">https://republicprotocol.com/</a></li>
                            </ol>
                        </li>
                        <li>
                            Payments
                            <ol>
                                <li>Any relevant Payments will be deducted by the Licensor from the User for the use of its Software in accordance with the processes outlined on its website at <a href="https://republicprotocol.com/" target="_blank" rel="noopener noreferrer">https://republicprotocol.com/</a></li>
                            </ol>
                        </li>
                        <li>
                            Warranties
                            <ol>
                                <li>The Licensor warrants to the User that it has the legal right and authority to enter into this EULA and to perform its obligations under this EULA.</li>
                                <li>The User warrants to the Licensor that it has the legal right and authority to enter into this EULA and to perform its obligations under this EULA.</li>
                                <li>All of the parties' warranties and representations in respect of the subject matter of this EULA are expressly set out in this EULA. To the maximum extent permitted by applicable law, no other warranties or representations concerning the subject matter of this EULA will be implied into this EULA or any related contract.</li>
                            </ol>
                        </li>
                        <li>
                            Acknowledgements and warranty limitations
                            <ol>
                                <li>The User acknowledges that complex software is never wholly free from defects, errors and bugs; and subject to the other provisions of this EULA, the Licensor gives no warranty or representation that the Software will be wholly free from defects, errors and bugs.</li>
                                <li>The User acknowledges that complex software is never entirely free from security vulnerabilities; and subject to the other provisions of this EULA, the Licensor gives no warranty or representation that the Software will be entirely secure.</li>
                                <li>The User acknowledges that the Software is only designed to be compatible with that software specified as compatible in the Software Specification; and the Licensor does not warrant or represent that the Software will be compatible with any other software.</li>
                                <li>The User acknowledges that the Licensor will not provide any legal, financial, accounting or taxation advice under this EULA or in relation to the Software; and, except to the extent expressly provided otherwise in this EULA, the Licensor does not warrant or represent that the Software or the use of the Software by the User will not give rise to any legal liability on the part of the User or any other person.</li>
                            </ol>
                        </li>
                        <li>
                            Indemnities
                            <ol>
                                <li>The User shall indemnify and shall keep indemnified the Licensor against any and all liabilities, damages, losses, costs and expenses (including legal expenses and amounts reasonably paid in settlement of legal claims) suffered or incurred by the Licensor and arising directly or indirectly as a result of any breach by the User of this EULA (a "User Indemnity Event").</li>
                                <li>
                                    The Licensor must:
                                    <ol type="a">
                                        <li>upon becoming aware of an actual or potential User Indemnity Event, notify the User;</li>
                                        <li>provide to the User all such assistance as may be reasonably requested by the User in relation to the User Indemnity Event;</li>
                                        <li>allow the User the exclusive conduct of all disputes, proceedings, negotiations and settlements with third parties relating to the User Indemnity Event; and</li>
                                        <li>not admit liability to any third party in connection with the User Indemnity Event or settle any disputes or proceedings involving a third party and relating to the User Indemnity Event without the prior written consent of the User,</li>
                                    </ol>
                                    without prejudice to the User's obligations under Clause 13.1.
                                </li>
                                <li>The indemnity protection set out in this Clause 13 shall not be subject to the limitations and exclusions of liability set out in this EULA.</li>
                            </ol>
                        </li>
                        <li>
                            Limitations and exclusions of liability
                            <ol>
                                <li>
                                    Nothing in this EULA will:
                                    <ol type="a">
                                        <li>limit or exclude any liability for death or personal injury resulting from negligence;</li>
                                        <li>limit or exclude any liability for fraud or fraudulent misrepresentation;</li>
                                        <li>limit any liabilities in any way that is not permitted under applicable law; or</li>
                                        <li>exclude any liabilities that may not be excluded under applicable law,</li>
                                    </ol>
                                    and, if a party is a consumer, that party's statutory rights will not be excluded or limited by this EULA, except to the extent permitted by law.
                                </li>
                                <li>
                                    The limitations and exclusions of liability set out in this Clause 14 and elsewhere in this EULA:
                                    <ol type="a">
                                        <li>are subject to Clause 14.1; and</li>
                                        <li>govern all liabilities arising under this EULA or relating to the subject matter of this EULA, including liabilities arising in contract, in tort (including negligence) and for breach of statutory duty, except to the extent expressly provided otherwise in this EULA.</li>
                                    </ol>
                                </li>
                                <li>The Licensor will not be liable to the User in respect of any losses arising out of a Force Majeure Event.</li>
                                <li>The Licensor will not be liable to the User in respect of any loss of profits or anticipated savings.</li>
                                <li>The Licensor will not be liable to the User in respect of any loss of revenue or income.</li>
                                <li>The Licensor will not be liable to the User in respect of any loss of business, contracts or opportunities.</li>
                                <li>The Licensor will not be liable to the User in respect of any loss or corruption of any data, database or software.</li>
                                <li>The Licensor will not be liable to the User in respect of any special, indirect or consequential loss or damage.</li>
                                <li>
                                    The liability of the Licensor to the User under this EULA in respect of any event or series of related events shall not exceed the greater of:
                                    <ol type="a">
                                        <li>the total amount paid and payable by the User to the Licensor under this EULA.</li>
                                    </ol>
                                </li>
                                <li>
                                    The aggregate liability of the Licensor to the User under this EULA shall not exceed the greater of:
                                    <ol type="a">
                                        <li>the total amount paid and payable by the User to the Licensor under this EULA.</li>
                                    </ol>
                                </li>
                            </ol>
                        </li>
                        <li>
                            Termination
                            <ol>
                                <li>The Licensor may terminate this EULA at its absolute own discretion by giving to the User written notice of termination.</li>
                                <li>The User may terminate this EULA by giving to the Licensor not less than 30 days' written notice of termination, expiring at the end of any calendar month.</li>
                                <li>
                                    Either party may terminate this EULA immediately by giving written notice of termination to the other party if:
                                    <ol type="a">
                                        <li>the other party commits any material breach of this EULA, and the breach is not remediable;</li>
                                        <li>the other party commits a material breach of this EULA, and the breach is remediable but the other party fails to remedy the breach within the period of 30 days following the giving of a written notice to the other party requiring the breach to be remedied; or</li>
                                        <li>the other party persistently breaches this EULA (irrespective of whether such breaches collectively constitute a material breach).</li>
                                    </ol>
                                </li>
                                <li>
                                    Either party may terminate this EULA immediately by giving written notice of termination to the other party if:
                                    <ol type="a">
                                        <li>
                                            the other party:
                                            <ol type="i">
                                                <li>is dissolved;</li>
                                                <li>ceases to conduct all (or substantially all) of its business;</li>
                                                <li>is or becomes unable to pay its debts as they fall due;</li>
                                                <li>is or becomes insolvent or is declared insolvent; or</li>
                                                <li>convenes a meeting or makes or proposes to make any arrangement or composition with its creditors;</li>
                                            </ol>
                                        </li>
                                        <li>an administrator, administrative receiver, liquidator, receiver, trustee, manager or similar is appointed over any of the assets of the other party;</li>
                                        <li>an order is made for the winding up of the other party, or the other party passes a resolution for its winding up (other than for the purpose of a solvent company reorganisation where the resulting entity will assume all the obligations of the other party under this EULA); or</li>
                                        <li>
                                            if that other party is an individual:
                                            <ol type="i">
                                                <li>that other party dies;</li>
                                                <li>as a result of illness or incapacity, that other party becomes incapable of managing his or her own affairs; or</li>
                                                <li>that other party is the subject of a bankruptcy petition or order.</li>
                                            </ol>
                                        </li>
                                    </ol>
                                </li>
                            </ol>
                        </li>
                        <li>
                            Effects of termination
                            <ol>
                                <li>Upon the termination of this EULA, all of the provisions of this EULA shall cease to have effect, save that the following provisions of this EULA shall survive and continue to have effect (in accordance with their express terms or otherwise indefinitely): Clauses 1, 4.1, 10.1, 13, 14, 16, 17 and 18.</li>
                                <li>Except to the extent that this EULA expressly provides otherwise, the termination of this EULA shall not affect the accrued rights of either party.</li>
                                <li>
                                    Within 30 days following the termination of this EULA for any reason:
                                    <ol type="a">
                                        <li>the User must pay to the Licensor any Charges in respect of Services provided to the User before the termination of this EULA and in respect of licences in effect before the termination of this EULA; and</li>
                                        <li>the Licensor must refund to the User any Charges paid by the User to the Licensor in respect of Services that were to be (but are not) provided to the User after the termination of this EULA and in respect of licences that were to be (but are not) in effect after the termination of this EULA,</li>
                                    </ol>
                                    without prejudice to the parties' other legal rights.
                                </li>
                                <li>For the avoidance of doubt, the licences of the Software in this EULA shall terminate upon the termination of this EULA; and, accordingly, the User must immediately cease to use the Software upon the termination of this EULA.</li>
                                <li>
                                    Within 10 Business Days following the termination of this EULA, the User must:
                                    <ol type="a">
                                        <li>return to the Licensor or dispose of as the Licensor may instruct all media in its possession or control containing the Software; and</li>
                                        <li>irrevocably delete from all computer systems in its possession or control all copies of the Software.</li>
                                    </ol>
                                </li>
                            </ol>
                        </li>
                        <li>
                            General
                            <ol>
                                <li>No breach of any provision of this EULA shall be waived except with the express written consent of the party not in breach.</li>
                                <li>If any provision of this EULA is determined by any court or other competent authority to be unlawful and/or unenforceable, the other provisions of this EULA will continue in effect. If any unlawful and/or unenforceable provision would be lawful or enforceable if part of it were deleted, that part will be deemed to be deleted, and the rest of the provision will continue in effect (unless that would contradict the clear intention of the parties, in which case the entirety of the relevant provision will be deemed to be deleted).</li>
                                <li>This EULA may not be varied except by a written document signed by or on behalf of each of the parties.</li>
                                <li>The User hereby agrees that the Licensor may assign the Licensor's contractual rights and obligations under this EULA to any successor to all or a substantial part of the business of the Licensor from time to time. The User must not without the prior written consent of the Licensor assign, transfer or otherwise deal with any of the User's contractual rights or obligations under this EULA.</li>
                                <li>This EULA is made for the benefit of the parties, and is not intended to benefit any third party or be enforceable by any third party. The rights of the parties to terminate, rescind, or agree any amendment, waiver, variation or settlement under or relating to this EULA are not subject to the consent of any third party.</li>
                                <li>Subject to Clause 14.1, this EULA shall constitute the entire agreement between the parties in relation to the subject matter of this EULA, and shall supersede all previous agreements, arrangements and understandings between the parties in respect of that subject matter.</li>
                                <li>This EULA shall be governed by and construed in accordance with the laws of the British Virgin Isles.</li>
                                <li>The courts of the British Virgin Isles shall have exclusive jurisdiction to adjudicate any dispute arising under or in connection with this EULA.</li>
                            </ol>
                        </li>
                        <li>
                            <ol>
                                <li>
                                    In this EULA, a reference to a statute or statutory provision includes a reference to:
                                    <ol type="a">
                                        <li>that statute or statutory provision as modified, consolidated and/or re-enacted from time to time; and</li>
                                        <li>any subordinate legislation made under that statute or statutory provision.</li>
                                    </ol>
                                </li>
                                <li>The Clause headings do not affect the interpretation of this EULA.</li>
                                <li>References in this EULA to "calendar months" are to the 12 named periods (January, February and so on) into which a year is divided.</li>
                                <li>In this EULA, general words shall not be given a restrictive interpretation by reason of being preceded or followed by words indicating a particular class of acts, matters or things.</li>
                            </ol>
                        </li>
                    </ol>
                </div>
                <p>By proceeding, you accept the above EULA agreement as well as the <a href="/terms-and-conditions.pdf" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a> and <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
                <button disabled={!scrollBottom} onClick={this.handleAgreement}>
                    <p>Accept &amp; Continue</p>
                </button>
            </div>
        );
    }

    private readonly handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
        const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 30;
        if (bottom) {
            this.setState({ scrollBottom: true });
        }
    }

    private readonly handleAgreement = (): void => {
        this.props.actions.agreeToTerms({ agreedToTerms: true });
        this.props.onDone();
    }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        agreeToTerms,
        clearPopup,
    }, dispatch)
});

interface Props extends ConnectedReturnType<typeof mapDispatchToProps> {
    onDone(): void;
}

interface State {
    scrollBottom: boolean;
}

const TermsPopup = connect(null, mapDispatchToProps)(TermsPopupClass);

export const newTermsPopup = (uuid: PopupID, onCancelAction: () => void, onDoneAction: () => void) => ({
    uuid,
    popup: <TermsPopup onDone={onDoneAction} />,
    dismissible: false,
    onCancel: onCancelAction,
});
