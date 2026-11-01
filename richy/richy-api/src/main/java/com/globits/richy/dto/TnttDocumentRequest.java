package com.globits.richy.dto;

import java.util.*;

public class TnttDocumentRequest {
    public Long id, revision, parentId, versionId;
    public String title, kind, requestKey, summary;
    public Boolean archived, shared, email;
    public Long startsAt, endsAt;
    public List<String> groups;
    public List<Long> userIds;
    public Map<String, Object> document;
}
