from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_delete_legacy_project_and_sequences"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("CREATE", "Create"),
                    ("UPDATE", "Update"),
                    ("DELETE", "Delete"),
                    ("LOGIN", "Login"),
                    ("EXPORT", "Export"),
                    ("APPROVE", "Approve"),
                    ("REJECT", "Reject"),
                    ("SUBMIT", "Submit"),
                ],
                max_length=20,
            ),
        ),
    ]
