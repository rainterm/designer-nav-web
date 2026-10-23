<script setup>
import { useMessage } from 'naive-ui'

const message = useMessage()
</script>

<template>
  <slot :message="message" />
</template>
