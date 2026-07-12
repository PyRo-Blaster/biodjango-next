from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("analysis", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="analysistask",
            name="task_type",
            field=models.CharField(
                choices=[
                    ("BLAST", "BLAST"),
                    ("IGBLAST", "IgBLAST"),
                    ("MSA", "Multiple Sequence Alignment"),
                ],
                max_length=20,
            ),
        ),
    ]
