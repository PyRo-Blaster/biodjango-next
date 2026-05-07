from rest_framework.throttling import UserRateThrottle


class TaskPollThrottle(UserRateThrottle):
    scope = "task_poll"
