package com.globits.richy.question;

import com.globits.richy.dto.TestFolderMoveDto;
import com.globits.richy.dto.TestFolderDto;
import com.globits.richy.rest.RestTestFolderController;
import com.globits.richy.service.impl.TestFolderServiceImpl;
import java.util.Map;
import org.junit.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.Matchers.*;

public class TestFolderControllerTest {
    @Test public void forbiddenMovesAndRenamesReturnReadablePermissionMessages() {
        TestFolderServiceImpl service = mock(TestFolderServiceImpl.class);
        when(service.moveTest(20L, 1L)).thenThrow(new AccessDeniedException("Bạn không có quyền chuyển bài test này."));
        when(service.save(any(TestFolderDto.class))).thenThrow(new AccessDeniedException("Bạn không có quyền sửa folder này."));
        RestTestFolderController controller = new RestTestFolderController();
        ReflectionTestUtils.setField(controller, "service", service);
        TestFolderMoveDto move = new TestFolderMoveDto(); move.setTestId(20L); move.setFolderId(1L);
        ResponseEntity<?> response = controller.moveTest(move);
        assertEquals(403, response.getStatusCodeValue());
        assertEquals("Bạn không có quyền chuyển bài test này.", ((Map<?, ?>) response.getBody()).get("message"));
        response = controller.save(new TestFolderDto());
        assertEquals(403, response.getStatusCodeValue());
        assertEquals("Bạn không có quyền sửa folder này.", ((Map<?, ?>) response.getBody()).get("message"));
    }
}
