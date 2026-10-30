package com.globits.richy.rest;

import com.globits.richy.dto.BattleOnlineExerciseTestDto;
import com.globits.richy.dto.BattleOnlineExerciseTestFilterDto;
import com.globits.richy.service.BattleExerciseCatalogService;
import com.globits.richy.service.BattleOnlineException;
import java.util.Collections;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/battle-online/exercise-tests")
@Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
public class RestBattleExerciseCatalogController {
    @Autowired private BattleExerciseCatalogService service;

    @RequestMapping(value = "/{pageIndex}/{pageSize}",method = RequestMethod.POST)
    public Page<BattleOnlineExerciseTestDto> search(@RequestBody(required = false) BattleOnlineExerciseTestFilterDto filters,
            @PathVariable("pageIndex") int pageIndex,@PathVariable("pageSize") int pageSize) {
        return service.search(filters,pageIndex,pageSize);
    }

    @ExceptionHandler(BattleOnlineException.class)
    public ResponseEntity<Map<String,String>> handle(BattleOnlineException error) {
        return ResponseEntity.status(error.getStatus()).body(Collections.singletonMap("message",error.getMessage()));
    }
}
