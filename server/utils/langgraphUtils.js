import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";

export const dispatchEvent = async (eventType, data) => {
  await dispatchCustomEvent(eventType, data);
}

export const sendMessageEvent = async (data) => {
  await dispatchEvent("message", data);
}

export const sendStatusEvent = async (data) => {
  await dispatchEvent("status", data);
}

export const sendToolPlanEvent = async (data) => {
  await dispatchEvent("tool_plan", data);
}

export const sendToolResultEvent = async (data) => {
  await dispatchEvent("tool_result", data);
}

export const sendToolErrorEvent = async (data) => {
  await dispatchEvent("tool_error", data);
}

export const sendErrorEvent = async (data) => {
  await dispatchEvent("error", data);
}