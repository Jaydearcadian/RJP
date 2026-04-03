import { logger, type IAgentRuntime, type Project, type ProjectAgent } from "@elizaos/core";

import { executionRouter } from "./characters/executionRouter.js";
import { judgmentScout } from "./characters/judgmentScout.js";

const initAgent =
  (label: string) =>
  async (runtime: IAgentRuntime): Promise<void> => {
    logger.info(`Initializing ${label}`);
    logger.info({ agentId: runtime.agentId }, `${label} agentId`);
  };

export const judgmentScoutAgent: ProjectAgent = {
  character: judgmentScout,
  init: initAgent(judgmentScout.name),
};

export const executionRouterAgent: ProjectAgent = {
  character: executionRouter,
  init: initAgent(executionRouter.name),
};

const project: Project = {
  agents: [judgmentScoutAgent, executionRouterAgent],
};

export default project;
