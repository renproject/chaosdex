import { createStandardAction } from "typesafe-actions";

// tslint:disable-next-line: ban-types
export type PopupID = Symbol;

export const newPopupID = () => Symbol();

export const setPopup = createStandardAction("SET_POPUP")<{
    uuid: PopupID;
    popup: JSX.Element;
    overlay?: boolean;
    dismissible?: boolean;
    onCancel(): void;
}>();

export const clearPopup = createStandardAction("CLEAR_POPUP")<{ uuid: PopupID }>();

export const setDismissible = createStandardAction("SET_DISMISSIBLE")<boolean>();
