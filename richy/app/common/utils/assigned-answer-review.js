(function (root) {
    'use strict';

    function deadlinePassed(task, taskId, now) {
        if (!task || String(task.taskId) !== String(taskId) || task.canStartNewAttempt === true
                || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(task.dueDate || '')) { return false; }
        var time = task.dueTime;
        if (time && !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) { return false; }
        var due = Date.parse(task.dueDate + 'T' + (time ? time + ':00' : '23:59:59.999') + '+07:00');
        return Number.isFinite(due) && now > due;
    }

    function loadDeadline(result, taskId, fetchAssignment) {
        if (!taskId || !fetchAssignment || typeof result.answerReviewLocked === 'boolean') { return; }
        return fetchAssignment(taskId).then(function (task) {
            result.answerReviewDeadlinePassed = deadlinePassed(task, taskId, Date.now());
        }, function () {
            result.answerReviewDeadlinePassed = false;
        });
    }

    root.AssignedAnswerReview = {deadlinePassed: deadlinePassed, loadDeadline: loadDeadline};
})(window);
