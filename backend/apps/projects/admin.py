from django.contrib import admin

from apps.projects.models import Epic, Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "priority", "assignee", "organization", "created_at"]
    list_filter = ["status", "priority", "organization"]
    search_fields = ["title", "description"]


@admin.register(Epic)
class EpicAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "priority", "project", "assignee", "organization", "created_at"]
    list_filter = ["status", "priority", "organization"]
    search_fields = ["title", "description"]
