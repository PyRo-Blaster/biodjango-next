from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("analysis", "0002_remove_peptide_calc_choice"),
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
                    ("PEPTIDE_CALC", "Peptide Calculator"),
                    ("PRIMER_DESIGN", "Primer Design"),
                    ("ANTIBODY_ANNOTATION", "Antibody Annotation"),
                ],
                max_length=20,
            ),
        ),
    ]
