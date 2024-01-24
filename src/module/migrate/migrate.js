export class MigratePbta {
	static async runMigration() {
		game.settings.set("pbta", "systemMigrationVersion", game.system.version);
	}
}
