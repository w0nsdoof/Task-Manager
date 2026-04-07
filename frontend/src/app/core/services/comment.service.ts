import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CommentAuthor {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
}

export interface CommentAttachment {
  id: number;
  filename: string;
  file_size: number;
  content_type: string;
  uploaded_by: { id: number; first_name: string; last_name: string };
  uploaded_at: string;
  download_url: string;
}

export interface Comment {
  id: number;
  author: CommentAuthor;
  content: string;
  is_public: boolean;
  mentions: { id: number; first_name: string; last_name: string }[];
  attachments: CommentAttachment[];
  created_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({ providedIn: 'root' })
export class CommentService {
  constructor(private http: HttpClient) {}

  list(taskId: number, page = 1): Observable<PaginatedResponse<Comment>> {
    const params = new HttpParams().set('page', String(page));
    return this.http.get<PaginatedResponse<Comment>>(
      `${environment.apiUrl}/tasks/${taskId}/comments/`,
      { params },
    );
  }

  create(
    taskId: number,
    content: string,
    isPublic = true,
    files: File[] = [],
  ): Observable<Comment> {
    const url = `${environment.apiUrl}/tasks/${taskId}/comments/`;
    if (!files.length) {
      return this.http.post<Comment>(url, { content, is_public: isPublic });
    }
    const formData = new FormData();
    formData.append('content', content);
    formData.append('is_public', String(isPublic));
    for (const f of files) {
      formData.append('files', f, f.name);
    }
    return this.http.post<Comment>(url, formData);
  }
}
