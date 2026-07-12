from django.db import migrations


def assert_legacy_tables_empty(apps, schema_editor):
    """Refuse to drop legacy tables while they still hold rows.

    core.Project / core.AA_Sequence / core.DNA_Sequence were replaced by
    projects.Project and projects.ProteinSequence in v2.x. Any lingering
    rows must be migrated to the new tables before this migration runs.
    """
    for model_name in ("AA_Sequence", "DNA_Sequence", "Project"):
        Model = apps.get_model("core", model_name)
        count = Model.objects.count()
        if count:
            raise RuntimeError(
                f"Cannot drop legacy table core_{model_name.lower()}: "
                f"{count} rows exist. Migrate data to projects.Project / "
                f"projects.ProteinSequence before running this migration."
            )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_auditlog"),
    ]

    operations = [
        migrations.RunPython(assert_legacy_tables_empty, migrations.RunPython.noop),
        migrations.DeleteModel(name="AA_Sequence"),
        migrations.DeleteModel(name="DNA_Sequence"),
        migrations.DeleteModel(name="Project"),
    ]
