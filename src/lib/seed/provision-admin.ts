/**
 * Admin provisioning (Stage 0 G10 — replaces the hardcoded seed superadmin).
 *
 * Creates or updates a superadmin account with real scrypt credentials.
 * NEVER hardcodes credentials. Two modes:
 *
 *   Interactive (no args):
 *     bun run src/lib/seed/provision-admin.ts
 *     — prompts for email + password (password input hidden when TTY).
 *
 *   Environment (CI / scripts):
 *     NYAYA_ADMIN_EMAIL=... NYAYA_ADMIN_PASSWORD=... \
 *       bun run src/lib/seed/provision-admin.ts
 *
 * Safety:
 *   - Refuses weak passwords (same policy as registration).
 *   - Prints only the email, never the password or its hash.
 *   - On an existing account it prompts/asks unless FORCE=true, then
 *     rotates the password and revokes all existing sessions.
 */
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

async function readHidden(prompt: string): Promise<string> {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let input = "";
    // Raw mode hides keystrokes when attached to a TTY.
    const stdin = process.stdin;
    const isTTY = stdin.isTTY;
    if (isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");
      stdin.on("data", (ch: string) => {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (ch === "\u0003") {
          process.exit(1);
        } else {
          input += ch;
        }
      });
    } else {
      rl.on("line", (line: string) => { rl.close(); resolve(line.trim()); });
    }
  });
}

async function ask(prompt: string): Promise<string> {
  const { createInterface } = await import("readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, (a: string) => { rl.close(); resolve(a.trim()); }));
}

async function main() {
  let email = process.env.NYAYA_ADMIN_EMAIL;
  let password = process.env.NYAYA_ADMIN_PASSWORD;

  if (!email) email = await ask("Admin email: ");
  if (!password) password = await readHidden("Admin password (input hidden): ");
  if (!password) password = await readHidden("Admin password (re-enter, stdin is not a TTY): ");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("[provision-admin] invalid email");
    process.exit(1);
  }
  const weak = validatePasswordStrength(password);
  if (weak) {
    console.error(`[provision-admin] ${weak}`);
    process.exit(1);
  }

  const emailNorm = email.trim().toLowerCase();
  const existing = (await db.user.findUnique?.({ where: { email: emailNorm } })) as
    | { id: string; role: string }
    | null;

  const passwordHash = await hashPassword(password);

  if (existing) {
    if (existing.role !== "superadmin" && process.env.FORCE !== "true") {
      const confirm = await ask(
        `User ${emailNorm} exists with role "${existing.role}". Promote to superadmin and reset password? [y/N]: `
      );
      if (confirm.toLowerCase() !== "y") {
        console.log("[provision-admin] aborted");
        process.exit(0);
      }
    }
    await db.user.update?.({
      where: { id: existing.id },
      data: { role: "superadmin", authProvider: "credentials", passwordHash, failedLogins: 0, lockedUntil: null },
    });
    // Revoke any old sessions — password was rotated.
    await db.session.updateMany?.({ where: { userId: existing.id }, data: { revokedAt: new Date() } });
    await db.auditLog.create?.({
      data: {
        action: "admin.provisioned",
        entityType: "user",
        entityId: existing.id,
        metadataJson: JSON.stringify({ email: emailNorm, rotated: true }),
      },
    });
    console.log(`[provision-admin] superadmin ready: ${emailNorm} (existing account updated, sessions revoked)`);
  } else {
    const id = "u" + (await import("crypto")).randomBytes(12).toString("hex");
    await db.user.create?.({
      data: {
        id,
        email: emailNorm,
        name: "Administrator",
        role: "superadmin",
        authProvider: "credentials",
        passwordHash,
      },
    });
    await db.profile.create?.({ data: { userId: id } });
    await db.auditLog.create?.({
      data: {
        action: "admin.provisioned",
        entityType: "user",
        entityId: id,
        metadataJson: JSON.stringify({ email: emailNorm, created: true }),
      },
    });
    console.log(`[provision-admin] superadmin created: ${emailNorm}`);
  }
  console.log("[provision-admin] done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
