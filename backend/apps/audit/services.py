from apps.audit.models import AuditLogEntry


def create_audit_entry(task=None, actor=None, action="", field_name="", old_value="", new_value="", project=None, epic=None):
    return AuditLogEntry.objects.create(
        task=task,
        project=project,
        epic=epic,
        actor=actor,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
    )
