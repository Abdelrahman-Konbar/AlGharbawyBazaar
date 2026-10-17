# Al-Gharbawy Bazaar — Batch 04 Release Checklist

## Installation

1. Run `Al-Gharbawy Bazaar Setup 1.0.0.exe` on the store Windows computer.
2. Complete the per-user installation.
3. Launch Al-Gharbawy Bazaar from the Start Menu or installed shortcut.
4. On the first sign-in, enter an administrator username and password of at least eight characters.
5. Create the first backup from Settings before entering operational data.

The application stores its SQLite database under Electron's Windows `userData` directory in `data\al-gharbawy-bazaar.sqlite`; backups are stored in the adjacent `backups` directory. The application does not require internet access after installation.

## Manual acceptance checklist

- [ ] First administrator setup and login
- [ ] Logout, wrong-password rejection, and re-login
- [ ] Create and edit a weight product with fixed-weight packs
- [ ] Create and edit a piece product
- [ ] Opening stock, receiving, and stock adjustment
- [ ] Movement history and low-stock notification
- [ ] Mixed weight, pack, and piece sale
- [ ] Receipt display/printing and sales history
- [ ] Dashboard and gross-profit report values
- [ ] Settings persistence after restart
- [ ] Manual backup, application restart, and backup restore
- [ ] Arabic RTL and English LTR layout review
- [ ] Cashier restrictions on products, inventory, reports, settings, and backups
- [ ] Installer launch and uninstall

Automated coverage is run with `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`, and `corepack pnpm build:desktop`. Interactive GUI, offline, restart, installation, and uninstall checks remain operator acceptance checks when a Windows desktop session is available.
