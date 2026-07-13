"""Celery tasks for analysis tools.

All tasks follow the same pattern: the caller creates an ``AnalysisTask`` row
synchronously, then dispatches the corresponding task which owns the row's
lifecycle (STARTED → SUCCESS/FAILURE). Errors are recorded on the row and the
task returns normally — no autoretry, so ``AnalysisTask.status`` is the single
source of truth for a task's outcome and ``.error_message`` explains failures.

``soft_time_limit`` caps the worst-case blocking of a Celery worker regardless
of what the underlying tool does.
"""

import logging
import os
import subprocess
import uuid

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from .models import AnalysisTask
from .utils import cumulative_calculator, generate_peptides
from .utils.antibody_annotation import annotate_antibody
from .utils.primer_design import design_primers

logger = logging.getLogger(__name__)


def _load_task(task_id):
    task = AnalysisTask.objects.get(id=task_id)
    task.status = 'STARTED'
    task.save(update_fields=['status', 'updated_at'])
    return task


def _mark_success(task, result):
    task.result = result
    task.status = 'SUCCESS'
    task.save(update_fields=['result', 'status', 'updated_at'])


def _mark_failure(task, message):
    task.status = 'FAILURE'
    task.error_message = message
    task.save(update_fields=['status', 'error_message', 'updated_at'])


@shared_task(bind=True, soft_time_limit=300)
def run_blast_task(self, task_id, sequence, evalue, db='swissprot'):
    task = _load_task(task_id)
    tmp_prefix = str(uuid.uuid4())
    input_path = f"/tmp/{tmp_prefix}.fasta"
    output_path = f"/tmp/{tmp_prefix}_output.txt"

    try:
        with open(input_path, "w") as f:
            f.write(sequence)

        from django.conf import settings
        db_path = os.path.join(settings.BLAST_DB_PATH, db)
        num_threads = os.environ.get("BLAST_NUM_THREADS", "4")

        command = [
            'blastp',
            '-query', input_path,
            '-out', output_path,
            '-db', db_path,
            '-evalue', str(evalue),
            '-num_threads', num_threads,
        ]

        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            _mark_failure(task, stderr.decode())
            return

        with open(output_path, 'r') as f:
            result_content = f.read()

        _mark_success(task, {"output": result_content})
    except SoftTimeLimitExceeded:
        _mark_failure(task, "BLAST task exceeded time limit.")
    except Exception as exc:
        logger.exception("BLAST task %s failed", task_id)
        _mark_failure(task, str(exc))
    finally:
        for path in (input_path, output_path):
            if os.path.exists(path):
                os.remove(path)


@shared_task(bind=True, soft_time_limit=300)
def run_msa_task(self, task_id, sequence):
    task = _load_task(task_id)
    tmp_prefix = str(uuid.uuid4())
    input_path = f"/tmp/{tmp_prefix}.fasta"
    output_path = f"/tmp/{tmp_prefix}_align.txt"

    try:
        with open(input_path, "w") as f:
            f.write(sequence)

        command = ['mafft', '--auto', '--clustalout', input_path]

        with open(output_path, 'w') as out_file:
            process = subprocess.Popen(command, stdout=out_file, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            _mark_failure(task, stderr.decode())
            return

        with open(output_path, 'r') as f:
            result_content = f.read()

        _mark_success(task, {"output": result_content})
    except SoftTimeLimitExceeded:
        _mark_failure(task, "MSA task exceeded time limit.")
    except Exception as exc:
        logger.exception("MSA task %s failed", task_id)
        _mark_failure(task, str(exc))
    finally:
        for path in (input_path, output_path):
            if os.path.exists(path):
                os.remove(path)


@shared_task(bind=True, soft_time_limit=120)
def run_peptide_calc_task(self, task_id, target_mass, error_range, num_amino_acids):
    task = _load_task(task_id)
    try:
        csv_data = generate_peptides(
            target_mass=target_mass,
            error_range=error_range,
            num_amino_acids=num_amino_acids,
        )
        _mark_success(task, {"csv_content": csv_data})
    except SoftTimeLimitExceeded:
        _mark_failure(
            task,
            "Peptide search exceeded time limit. Try fewer amino acids or a "
            "tighter error range.",
        )
    except Exception as exc:
        logger.exception("Peptide-calc task %s failed", task_id)
        _mark_failure(task, str(exc))


@shared_task(bind=True, soft_time_limit=30)
def run_primer_design_task(self, task_id, sequence, product_size_range, tm_opt):
    task = _load_task(task_id)
    try:
        result = design_primers(
            sequence=sequence,
            product_size_range=product_size_range,
            tm_opt=tm_opt,
        )
        if isinstance(result, dict) and 'error' in result:
            _mark_failure(task, result.get('details') or result['error'])
            return
        _mark_success(task, result)
    except SoftTimeLimitExceeded:
        _mark_failure(task, "Primer design exceeded time limit.")
    except Exception as exc:
        logger.exception("Primer-design task %s failed", task_id)
        _mark_failure(task, str(exc))


@shared_task(bind=True, soft_time_limit=30)
def run_antibody_annotation_task(self, task_id, sequence, scheme):
    task = _load_task(task_id)
    try:
        result = annotate_antibody(sequence=sequence, scheme=scheme)
        if isinstance(result, dict) and result.get('status') == 'error':
            _mark_failure(task, result.get('message', 'Annotation failed'))
            return
        _mark_success(task, result)
    except SoftTimeLimitExceeded:
        _mark_failure(task, "Antibody annotation exceeded time limit.")
    except Exception as exc:
        logger.exception("Antibody-annotation task %s failed", task_id)
        _mark_failure(task, str(exc))


# Sequence analysis stays inline: FASTA parsing is inherently fast and the
# view accepts multipart file uploads, which don't fit the JSON task-dispatch
# shape cleanly. Left here as a re-export for legacy imports.
__all__ = [
    'run_blast_task',
    'run_msa_task',
    'run_peptide_calc_task',
    'run_primer_design_task',
    'run_antibody_annotation_task',
    'cumulative_calculator',
]
