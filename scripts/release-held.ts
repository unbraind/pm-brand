/** Reject local publishing while the owner holds the first release. */
throw new Error('Release held: depend on an exact git commit until owner approval.');
