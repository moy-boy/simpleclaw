import { describeProviderContracts } from "../../plugin-sdk/test-helpers/provider-contract.js";

for (const providerId of ["openai"] as const) {
  describeProviderContracts(providerId);
}
