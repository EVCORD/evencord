/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

"use strict";
const fs = require("node:fs"), crypto = require("node:crypto");
const runtime = require("../branding/release-runtime.cjs"), trust = require("../branding/trust.json");
const [manifestPath,keyId,outputPath] = process.argv.slice(2);
if (!manifestPath || !keyId || !outputPath) throw Error("Usage: sign-release.cjs MANIFEST KEY_ID OUTPUT (Ed25519 private PEM on stdin)");
if (!Object.hasOwn(trust.keys,keyId) || trust.revoked.includes(keyId)) throw Error("Signing key is not enrolled in the reviewed public trust store.");
const bytes = fs.readFileSync(manifestPath), manifest = JSON.parse(bytes);
const key = crypto.createPrivateKey(fs.readFileSync(0));
if (key.asymmetricKeyType !== "ed25519") throw Error("Ed25519 key required.");
const envelope = Buffer.from(JSON.stringify({keyId,signed:bytes.toString("base64"),signature:crypto.sign(null,Buffer.concat([Buffer.from("EvenCord release v1\n"),bytes]),key).toString("base64")}));
runtime.verify(envelope,trust,manifest.component);
fs.writeFileSync(outputPath,envelope,{flag:"wx",mode:0o600});
console.log("Signed metadata written; private key material was not written to disk.");
