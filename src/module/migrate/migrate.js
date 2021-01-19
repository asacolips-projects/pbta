export class MigratePbta {

  static runMigration() {
    // Retrieve the version.
    let version = game.settings.get('pbta', 'systemMigrationVersion');

    // Update 1: Assign basic/special moves on actors.
    // if (version < 1) {
    //   this.updateSpecialMoves();
    //   version++;
    //   game.settings.set('pbta', 'systemMigrationVersion', version);
    // }
  }

}
