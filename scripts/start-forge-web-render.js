#!/usr/bin/env node
"use strict";

const { applyRenderPrivateNetworkEnv } = require("./forge-render-private-network");

applyRenderPrivateNetworkEnv(process.env);
require("./start-forge-web");
