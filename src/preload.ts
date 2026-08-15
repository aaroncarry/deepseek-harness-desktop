/**
 * Deliberately empty preload for the loopback-Web phase.
 *
 * Renderer code receives no Node, filesystem, process, or generic IPC access.
 * The later IPC carrier will expose a narrow typed transport from this one file.
 */

export {}
