from celery import shared_task
import subprocess
import os
import uuid
from .models import AnalysisTask

@shared_task(bind=True)
def run_blast_task(self, task_id, sequence, evalue, db='swissprot'):
    try:
        task = AnalysisTask.objects.get(id=task_id)
        task.status = 'STARTED'
        task.save()

        # Temporary file handling
        tmp_prefix = str(uuid.uuid4())
        input_path = f"/tmp/{tmp_prefix}.fasta"
        output_path = f"/tmp/{tmp_prefix}_output.txt"

        with open(input_path, "w") as f:
            f.write(sequence)

        # Build command (Ensure blastp is in PATH or use absolute path from settings)
        # Assuming DB is mounted at /data/blastdb inside container
        db_path = f"/data/blastdb/{db}"
        
        command = [
            'blastp',
            '-query', input_path,
            '-out', output_path,
            '-db', db_path,
            '-evalue', str(evalue),
            '-num_threads', "4" # Adjusted threads
        ]

        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode()
            task.status = 'FAILURE'
            task.error_message = error_msg
            task.save()
            return {"status": "error", "message": error_msg}

        # Read result
        with open(output_path, 'r') as f:
            result_content = f.read()

        # Cleanup
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)

        task.status = 'SUCCESS'
        task.result = {"output": result_content}
        task.save()
        
        return {"status": "success", "task_id": task_id}

    except Exception as e:
        if 'task' in locals():
            task.status = 'FAILURE'
            task.error_message = str(e)
            task.save()
        return {"status": "error", "message": str(e)}

@shared_task(bind=True)
def run_msa_task(self, task_id, sequence):
    try:
        task = AnalysisTask.objects.get(id=task_id)
        task.status = 'STARTED'
        task.save()

        tmp_prefix = str(uuid.uuid4())
        input_path = f"/tmp/{tmp_prefix}.fasta"
        output_path = f"/tmp/{tmp_prefix}_align.txt"

        with open(input_path, "w") as f:
            f.write(sequence)

        # Using MAFFT
        # mafft --auto --clustalout input > output
        command = f"mafft --auto --clustalout {input_path} > {output_path}"

        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode()
            task.status = 'FAILURE'
            task.error_message = error_msg
            task.save()
            return {"status": "error", "message": error_msg}

        with open(output_path, 'r') as f:
            result_content = f.read()

        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)

        task.status = 'SUCCESS'
        task.result = {"output": result_content}
        task.save()

        return {"status": "success", "task_id": task_id}

    except Exception as e:
        if 'task' in locals():
            task.status = 'FAILURE'
            task.error_message = str(e)
            task.save()
        return {"status": "error", "message": str(e)}
