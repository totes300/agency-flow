/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as clients from "../clients.js";
import type * as http from "../http.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as projects from "../projects.js";
import type * as retainerPeriods from "../retainerPeriods.js";
import type * as search from "../search.js";
import type * as users from "../users.js";
import type * as workCategories from "../workCategories.js";
import type * as workspaceSettings from "../workspaceSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  clients: typeof clients;
  http: typeof http;
  "lib/permissions": typeof lib_permissions;
  projects: typeof projects;
  retainerPeriods: typeof retainerPeriods;
  search: typeof search;
  users: typeof users;
  workCategories: typeof workCategories;
  workspaceSettings: typeof workspaceSettings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
